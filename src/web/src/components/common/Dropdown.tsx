import React, { useState, useCallback, useRef, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.0
import styled from '@emotion/styled'; // ^11.0.0
import debounce from 'lodash/debounce'; // ^4.0.8
import { useKeyboardNavigation, useClickOutside } from '@blitzy/hooks'; // ^1.0.0
import { useTheme } from '../../hooks/useTheme';
import Button from './Button';

// Styled components with theme-based styling
const StyledDropdown = styled.div<{ error?: string; disabled?: boolean }>`
  position: relative;
  width: 100%;
  font-family: inherit;

  ${({ theme, error, disabled }) => `
    &:focus-within {
      outline: 2px solid ${theme.colors.focus};
      outline-offset: 2px;
    }

    ${error ? `
      border-color: ${theme.colors.danger};
      &:focus-within {
        outline-color: ${theme.colors.danger};
      }
    ` : ''}

    ${disabled ? `
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    ` : ''}
  `}
`;

const DropdownMenu = styled.ul<{ open: boolean; maxHeight?: number }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  margin-top: 4px;
  padding: 4px 0;
  border-radius: 6px;
  overflow-y: auto;
  list-style: none;

  ${({ theme, open, maxHeight }) => `
    background: ${theme.colors.surface};
    border: 1px solid ${theme.colors.border};
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-height: ${maxHeight ? `${maxHeight}px` : '300px'};
    
    opacity: ${open ? 1 : 0};
    visibility: ${open ? 'visible' : 'hidden'};
    transform: ${open ? 'translateY(0)' : 'translateY(-8px)'};
    transition: all 200ms ease-in-out;
  `}
`;

const DropdownOption = styled.li<{ selected?: boolean; highlighted?: boolean; disabled?: boolean }>`
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;

  ${({ theme, selected, highlighted, disabled }) => `
    color: ${theme.colors.text};
    background: ${
      selected 
        ? theme.colors.primary + '1A'
        : highlighted 
          ? theme.colors.hover 
          : 'transparent'
    };

    ${disabled ? `
      opacity: 0.5;
      cursor: not-allowed;
    ` : `
      &:hover {
        background: ${theme.colors.hover};
      }
    `}

    &:focus {
      outline: none;
      background: ${theme.colors.hover};
    }
  `}
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px;
  border: none;
  outline: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

interface DropdownProps extends BlitzyComponentProps {
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  value: string | number | Array<string | number>;
  onChange: (value: string | number | Array<string | number>) => void;
  placeholder?: string;
  multiSelect?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
  maxHeight?: number;
  virtualized?: boolean;
  loading?: boolean;
}

const Dropdown: React.FC<DropdownProps> = React.memo(({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  multiSelect = false,
  searchable = false,
  disabled = false,
  error,
  maxHeight,
  virtualized = false,
  loading = false,
  className,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Filter options based on search input
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchValue) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchable, searchValue]);

  // Handle search input changes with debounce
  const handleSearchChange = useCallback(
    debounce((value: string) => {
      setSearchValue(value);
      setHighlightedIndex(-1);
    }, 300),
    []
  );

  // Handle option selection
  const handleSelect = useCallback((option: typeof options[0]) => {
    if (option.disabled) return;

    if (multiSelect) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [multiSelect, value, onChange]);

  // Handle keyboard navigation
  useKeyboardNavigation({
    onKeyDown: (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    deps: [isOpen, highlightedIndex, filteredOptions],
  });

  // Get selected option label(s)
  const selectedLabel = useMemo(() => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : [];
      const labels = options
        .filter(opt => selectedValues.includes(opt.value))
        .map(opt => opt.label);
      return labels.length ? labels.join(', ') : placeholder;
    } else {
      const selectedOption = options.find(opt => opt.value === value);
      return selectedOption ? selectedOption.label : placeholder;
    }
  }, [value, options, multiSelect, placeholder]);

  return (
    <StyledDropdown
      ref={dropdownRef}
      className={classNames('blitzy-dropdown', className)}
      error={error}
      disabled={disabled}
      theme={theme}
    >
      <Button
        variant="secondary"
        fullWidth
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        disabled={disabled}
        error={error}
        loading={loading}
      >
        {selectedLabel}
      </Button>

      <DropdownMenu
        open={isOpen}
        maxHeight={maxHeight}
        theme={theme}
        role="listbox"
        aria-multiselectable={multiSelect}
      >
        {searchable && (
          <SearchInput
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            onChange={e => handleSearchChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            theme={theme}
            aria-label="Search options"
          />
        )}

        {filteredOptions.map((option, index) => (
          <DropdownOption
            key={option.value}
            selected={multiSelect 
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value
            }
            highlighted={index === highlightedIndex}
            disabled={option.disabled}
            onClick={() => handleSelect(option)}
            role="option"
            aria-selected={value === option.value}
            aria-disabled={option.disabled}
            theme={theme}
          >
            {option.label}
          </DropdownOption>
        ))}

        {filteredOptions.length === 0 && (
          <DropdownOption disabled theme={theme}>
            No options available
          </DropdownOption>
        )}
      </DropdownMenu>
    </StyledDropdown>
  );
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;