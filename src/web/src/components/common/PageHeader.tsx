import React from 'react'; // ^18.0.0
import styled from '@emotion/styled'; // ^11.0.0
import Button from './Button';
import { useTheme } from '../../hooks/useTheme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
  className?: string;
  ariaLabel?: string;
}

const HeaderContainer = styled.header<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing || '24px'};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
  transition: all 0.3s ease;
  width: 100%;

  @media (max-width: ${({ theme }) => theme.breakpoints?.tablet || '768px'}px) {
    flex-direction: column;
    gap: 16px;
    padding: ${({ theme }) => (theme.spacing && theme.spacing * 0.75) || '16px'};
  }
`;

const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text};
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;
  margin: 0;
  line-height: 1.4;
`;

const ActionsContainer = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: ${({ theme }) => theme.breakpoints?.tablet || '768px'}px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const BreadcrumbsContainer = styled.nav`
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;

  @media (max-width: ${({ theme }) => theme.breakpoints?.tablet || '768px'}px) {
    width: 100%;
    text-align: left;
  }
`;

const PageHeader = React.memo<PageHeaderProps>(({
  title,
  subtitle,
  actions,
  showBreadcrumbs = false,
  className,
  ariaLabel,
}) => {
  const { theme } = useTheme();

  return (
    <HeaderContainer
      theme={theme}
      className={`blitzy-page-header ${className || ''}`}
      role="banner"
      aria-label={ariaLabel || 'Page header'}
    >
      <div>
        {showBreadcrumbs && (
          <BreadcrumbsContainer
            aria-label="Breadcrumb navigation"
            role="navigation"
            theme={theme}
          >
            {/* Breadcrumbs implementation would go here */}
            {/* Left as a placeholder as it's not in the current requirements */}
          </BreadcrumbsContainer>
        )}
        <TitleSection>
          <Title theme={theme}>{title}</Title>
          {subtitle && <Subtitle theme={theme}>{subtitle}</Subtitle>}
        </TitleSection>
      </div>

      {actions && (
        <ActionsContainer theme={theme}>
          {actions}
        </ActionsContainer>
      )}
    </HeaderContainer>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;