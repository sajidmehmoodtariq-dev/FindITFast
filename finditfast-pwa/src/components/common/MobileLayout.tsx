import React, { type ReactNode } from 'react';

interface MobileLayoutProps {
  children: ReactNode;
  className?: string;
  showSafeArea?: boolean;
  maxWidth?: 'mobile-sm' | 'mobile' | 'full';
}

/**
 * Mobile-first layout component that provides consistent mobile-optimized layout
 * with safe area support and proper touch targets
 */
export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  className = '',
  showSafeArea = true,
  maxWidth = 'mobile'
}) => {
  const safeAreaClasses = showSafeArea ? 'pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right' : '';
  const maxWidthClass = maxWidth === 'full' ? '' : `max-w-${maxWidth} mx-auto`;

  return (
    <div className={`
      min-h-screen-safe bg-gradient-to-br from-slate-50 to-slate-100
      ${safeAreaClasses}
      ${maxWidthClass}
      ${className}
    `}>
      {children}
    </div>
  );
};

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
}

/**
 * Mobile-optimized header component with proper touch targets and safe area support
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  className = ''
}) => {
  return (
    <header className={`
      bg-white/95 backdrop-blur-lg border-b border-slate-200/50
      sticky top-0 z-40 pt-safe-top
      ${className}
    `}>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between min-h-touch">
          {/* Back Button */}
          {showBack && (
            <button
              onClick={onBack}
              className="touch-target-lg rounded-xl bg-slate-100 hover:bg-slate-200 
                       transition-colors duration-200 flex items-center justify-center"
              aria-label="Go back"
            >
              <svg 
                className="w-5 h-5 text-slate-700" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 19l-7-7 7-7" 
                />
              </svg>
            </button>
          )}

          {/* Title Section */}
          <div className="flex-1 text-center px-4">
            {title && (
              <h1 className="text-lg font-semibold text-slate-900 truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-slate-600 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right Action */}
          <div className="flex items-center">
            {rightAction || <div className="w-12" />}
          </div>
        </div>
      </div>
    </header>
  );
};

interface MobileContentProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Mobile-optimized content container with proper spacing and touch-friendly layout
 */
export const MobileContent: React.FC<MobileContentProps> = ({
  children,
  className = '',
  padding = 'md'
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6'
  };

  return (
    <main className={`
      flex-1 min-h-0
      ${paddingClasses[padding]}
      ${className}
    `}>
      {children}
    </main>
  );
};

interface MobileBottomBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Mobile bottom bar with safe area support for navigation or actions
 */
export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`
      bg-white/95 backdrop-blur-lg border-t border-slate-200/50
      pb-safe-bottom px-4 py-3
      ${className}
    `}>
      <div className="flex items-center justify-center min-h-touch">
        {children}
      </div>
    </div>
  );
};

interface TouchAreaProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'default' | 'large';
  variant?: 'button' | 'card' | 'icon';
  disabled?: boolean;
}

/**
 * Touch-optimized interactive area with proper accessibility and feedback
 */
export const TouchArea: React.FC<TouchAreaProps> = ({
  children,
  onClick,
  className = '',
  size = 'default',
  variant = 'button',
  disabled = false
}) => {
  const sizeClasses = {
    default: 'min-h-touch min-w-touch',
    large: 'min-h-touch-lg min-w-touch-lg'
  };

  const variantClasses = {
    button: 'rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md active:scale-95',
    card: 'rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg active:scale-[0.98]',
    icon: 'rounded-xl hover:bg-slate-100 active:bg-slate-200'
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${variant === 'card' ? 'block text-left' : 'flex items-center justify-center'} cursor-pointer
        transition-all duration-200 touch-manipulation
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
};
