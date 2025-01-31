import React, { useCallback, useEffect, useMemo } from 'react';
import * as yup from 'yup'; // ^1.0.0
import { useTranslation } from 'react-i18next'; // ^12.0.0
import Form from '../../components/common/Form';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ValidationError } from '../../utils/validation';

// Supported timezones from IANA Time Zone Database
const validTimezones = Intl.supportedValuesOf('timeZone');

// Supported languages based on i18n configuration
const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru'];

// Profile form validation schema with enterprise-grade rules
const validationSchema = yup.object().shape({
  firstName: yup
    .string()
    .required('settings.profile.validation.firstName.required')
    .min(2, 'settings.profile.validation.firstName.min')
    .max(50, 'settings.profile.validation.firstName.max')
    .matches(/^[a-zA-Z\s-']+$/, 'settings.profile.validation.firstName.format'),
    
  lastName: yup
    .string()
    .required('settings.profile.validation.lastName.required')
    .min(2, 'settings.profile.validation.lastName.min')
    .max(50, 'settings.profile.validation.lastName.max')
    .matches(/^[a-zA-Z\s-']+$/, 'settings.profile.validation.lastName.format'),
    
  email: yup
    .string()
    .required('settings.profile.validation.email.required')
    .email('settings.profile.validation.email.format')
    .max(255, 'settings.profile.validation.email.max'),
    
  phoneNumber: yup
    .string()
    .nullable()
    .matches(/^\+?[1-9]\d{1,14}$/, 'settings.profile.validation.phone.format'),
    
  timezone: yup
    .string()
    .required('settings.profile.validation.timezone.required')
    .oneOf(validTimezones, 'settings.profile.validation.timezone.invalid'),
    
  language: yup
    .string()
    .required('settings.profile.validation.language.required')
    .oneOf(supportedLanguages, 'settings.profile.validation.language.invalid'),
    
  theme: yup
    .string()
    .required('settings.profile.validation.theme.required')
    .oneOf(['light', 'dark'], 'settings.profile.validation.theme.invalid'),
    
  notifications: yup.object().shape({
    email: yup.boolean(),
    push: yup.boolean(),
    sms: yup.boolean()
  }).required('settings.profile.validation.notifications.required')
});

// Profile form interface with strict typing
interface ProfileFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  timezone: string;
  language: string;
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

const Profile = React.memo(() => {
  const { t } = useTranslation('settings');
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  // Initialize form with current user data
  const initialValues: ProfileFormValues = useMemo(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language.split('-')[0],
    theme: theme.mode,
    notifications: {
      email: true,
      push: true,
      sms: false
    }
  }), [user, theme.mode]);

  // Handle form submission with error handling and analytics
  const handleSubmit = useCallback(async (values: ProfileFormValues) => {
    try {
      // Update theme if changed
      if (values.theme !== theme.mode) {
        setTheme({
          ...theme,
          mode: values.theme
        });
      }

      // Update user profile
      await updateProfile({
        ...values,
        updatedAt: new Date().toISOString()
      });

      // Track successful profile update
      if (window.analytics) {
        window.analytics.track('Profile Updated', {
          userId: user?.id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(t('settings.profile.error.update'));
    }
  }, [theme, setTheme, updateProfile, user, t]);

  // Set up page title for accessibility
  useEffect(() => {
    document.title = `${t('settings.profile.title')} | ${t('app.name')}`;
  }, [t]);

  return (
    <div className="blitzy-profile-settings">
      <h1 className="text-2xl font-bold mb-6" role="heading" aria-level={1}>
        {t('settings.profile.title')}
      </h1>

      <Form
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        className="max-w-2xl"
      >
        {({ isSubmitting, dirty }) => (
          <>
            <div className="space-y-6">
              {/* Personal Information Section */}
              <section aria-labelledby="personal-info-heading">
                <h2 
                  id="personal-info-heading"
                  className="text-lg font-medium mb-4"
                >
                  {t('settings.profile.sections.personal')}
                </h2>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Form.Input
                    name="firstName"
                    label={t('settings.profile.fields.firstName')}
                    required
                    autoComplete="given-name"
                  />
                  
                  <Form.Input
                    name="lastName"
                    label={t('settings.profile.fields.lastName')}
                    required
                    autoComplete="family-name"
                  />
                  
                  <Form.Input
                    name="email"
                    label={t('settings.profile.fields.email')}
                    type="email"
                    required
                    autoComplete="email"
                    className="sm:col-span-2"
                  />
                  
                  <Form.Input
                    name="phoneNumber"
                    label={t('settings.profile.fields.phone')}
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
              </section>

              {/* Preferences Section */}
              <section aria-labelledby="preferences-heading">
                <h2 
                  id="preferences-heading"
                  className="text-lg font-medium mb-4"
                >
                  {t('settings.profile.sections.preferences')}
                </h2>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Form.Select
                    name="timezone"
                    label={t('settings.profile.fields.timezone')}
                    options={validTimezones.map(tz => ({
                      value: tz,
                      label: tz
                    }))}
                    required
                  />
                  
                  <Form.Select
                    name="language"
                    label={t('settings.profile.fields.language')}
                    options={supportedLanguages.map(lang => ({
                      value: lang,
                      label: t(`settings.profile.languages.${lang}`)
                    }))}
                    required
                  />
                  
                  <Form.Select
                    name="theme"
                    label={t('settings.profile.fields.theme')}
                    options={[
                      { value: 'light', label: t('settings.profile.themes.light') },
                      { value: 'dark', label: t('settings.profile.themes.dark') }
                    ]}
                    required
                  />
                </div>
              </section>

              {/* Notifications Section */}
              <section aria-labelledby="notifications-heading">
                <h2 
                  id="notifications-heading"
                  className="text-lg font-medium mb-4"
                >
                  {t('settings.profile.sections.notifications')}
                </h2>
                
                <div className="space-y-4">
                  <Form.Checkbox
                    name="notifications.email"
                    label={t('settings.profile.notifications.email')}
                  />
                  
                  <Form.Checkbox
                    name="notifications.push"
                    label={t('settings.profile.notifications.push')}
                  />
                  
                  <Form.Checkbox
                    name="notifications.sms"
                    label={t('settings.profile.notifications.sms')}
                  />
                </div>
              </section>
            </div>

            {/* Form Actions */}
            <div className="mt-8 flex justify-end space-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.history.back()}
              >
                {t('common.cancel')}
              </Button>
              
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={!dirty || isSubmitting}
              >
                {t('common.save')}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  );
});

Profile.displayName = 'Profile';

export default Profile;