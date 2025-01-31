import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { toMatchInlineSnapshot } from 'jest-snapshot'; // v29.0.0
import { 
  ValidationError, 
  validateEmail, 
  validatePassword, 
  validateLoginCredentials 
} from '../../src/utils/validation';

// Add snapshot matcher
expect.extend({ toMatchInlineSnapshot });

describe('ValidationError', () => {
  it('should construct with proper error properties', () => {
    const error = new ValidationError('Test message', 'email', 'TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.field).toBe('email');
    expect(error.code).toBe('TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should capture stack trace in non-production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new ValidationError('Test', 'field', 'CODE');
    expect(error.stack).toBeDefined();
    process.env.NODE_ENV = originalEnv;
  });
});

describe('validateEmail', () => {
  const validEmails = [
    'test@example.com',
    'test.name@example.co.uk',
    'test+label@example.com',
    'valid.email@subdomain.example.com',
    '123@example.com'
  ];

  const invalidEmails = [
    '',
    'invalid',
    '@example.com',
    'test@',
    'test@.com',
    'test@example.',
    'test@example..com',
    'test@example.c',
    'a'.repeat(65) + '@example.com',
    'test@' + 'a'.repeat(255) + '.com'
  ];

  it.each(validEmails)('should validate correct email format: %s', (email) => {
    expect(() => validateEmail(email)).not.toThrow();
    expect(validateEmail(email)).toBe(true);
  });

  it.each(invalidEmails)('should reject invalid email format: %s', (email) => {
    expect(() => validateEmail(email)).toThrow(ValidationError);
  });

  it('should handle null/undefined input', () => {
    expect(() => validateEmail(null as any)).toThrow(ValidationError);
    expect(() => validateEmail(undefined as any)).toThrow(ValidationError);
  });

  it('should trim and lowercase email before validation', () => {
    expect(() => validateEmail('  Test@EXAMPLE.com  ')).not.toThrow();
  });

  it('should validate domain-specific requirements', () => {
    expect(() => validateEmail('test@-invalid.com')).toThrow(ValidationError);
    expect(() => validateEmail('test@invalid-.com')).toThrow(ValidationError);
    expect(() => validateEmail('test@inv..alid.com')).toThrow(ValidationError);
  });

  it('should enforce maximum length restrictions', () => {
    const longLocalPart = 'a'.repeat(65) + '@example.com';
    const longDomain = 'test@' + 'a'.repeat(255) + '.com';
    
    expect(() => validateEmail(longLocalPart)).toThrow(ValidationError);
    expect(() => validateEmail(longDomain)).toThrow(ValidationError);
  });
});

describe('validatePassword', () => {
  const validPasswords = [
    'Password123!',
    'Complex@Pass1',
    'Str0ng!Pass',
    'V3ry$ecure'
  ];

  const invalidPasswords = [
    '',
    'short1!',
    'nouppercasepass1!',
    'NOLOWERCASEPASS1!',
    'NoSpecialChar1',
    'NoNumber!Pass',
    'Repeated!!!1',
    'Password123'
  ];

  it.each(validPasswords)('should validate correct password format: %s', (password) => {
    expect(() => validatePassword(password)).not.toThrow();
    expect(validatePassword(password)).toBe(true);
  });

  it.each(invalidPasswords)('should reject invalid password format: %s', (password) => {
    expect(() => validatePassword(password)).toThrow(ValidationError);
  });

  it('should handle null/undefined input', () => {
    expect(() => validatePassword(null as any)).toThrow(ValidationError);
    expect(() => validatePassword(undefined as any)).toThrow(ValidationError);
  });

  it('should enforce minimum length requirement', () => {
    expect(() => validatePassword('Short1!')).toThrow(ValidationError);
  });

  it('should require mixed case characters', () => {
    expect(() => validatePassword('lowercase123!')).toThrow(ValidationError);
    expect(() => validatePassword('UPPERCASE123!')).toThrow(ValidationError);
  });

  it('should require numbers and special characters', () => {
    expect(() => validatePassword('NoNumbersHere!')).toThrow(ValidationError);
    expect(() => validatePassword('NoSpecialChars123')).toThrow(ValidationError);
  });

  it('should prevent repeated characters', () => {
    expect(() => validatePassword('PasssssWord123!')).toThrow(ValidationError);
  });

  it('should reject common password patterns', () => {
    expect(() => validatePassword('Password123!')).toThrow(ValidationError);
    expect(() => validatePassword('Qwerty123!')).toThrow(ValidationError);
  });
});

describe('validateLoginCredentials', () => {
  const validCredentials = {
    email: 'test@example.com',
    password: 'Valid@Pass123'
  };

  it('should validate correct credentials', async () => {
    await expect(validateLoginCredentials(validCredentials)).resolves.toBe(true);
  });

  it('should reject missing email', async () => {
    const credentials = { ...validCredentials, email: '' };
    await expect(validateLoginCredentials(credentials)).rejects.toThrow(ValidationError);
  });

  it('should reject missing password', async () => {
    const credentials = { ...validCredentials, password: '' };
    await expect(validateLoginCredentials(credentials)).rejects.toThrow(ValidationError);
  });

  it('should reject invalid email format', async () => {
    const credentials = { ...validCredentials, email: 'invalid-email' };
    await expect(validateLoginCredentials(credentials)).rejects.toThrow(ValidationError);
  });

  it('should reject invalid password format', async () => {
    const credentials = { ...validCredentials, password: 'weak' };
    await expect(validateLoginCredentials(credentials)).rejects.toThrow(ValidationError);
  });

  it('should handle null/undefined credentials', async () => {
    await expect(validateLoginCredentials(null as any)).rejects.toThrow(ValidationError);
    await expect(validateLoginCredentials(undefined as any)).rejects.toThrow(ValidationError);
  });

  it('should validate credentials structure', async () => {
    const invalidStructure = { 
      email: 'test@example.com',
      password: 'Valid@Pass123',
      extraField: 'invalid'
    };
    await expect(validateLoginCredentials(invalidStructure as any)).resolves.toBe(true);
  });

  it('should maintain performance under load', async () => {
    const startTime = Date.now();
    await validateLoginCredentials(validCredentials);
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(100); // 100ms timeout
  });
});