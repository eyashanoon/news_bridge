/**
 * AvatarStudioFrame
 * 
 * A reusable React component that embeds the Avatar Studio app in an iframe.
 * Designed for safe integration into other React projects with full customization.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.src='avatar-studio/legacy.html'] - URL to the embedded app
 * @param {string} [props.title='Avatar Studio'] - Iframe title (accessibility)
 * @param {string|number} [props.width='100%'] - Width (e.g., '800px', 800)
 * @param {string|number} [props.height='100%'] - Height (e.g., '600px', 600)
 * @param {Object} [props.style={}] - Extra CSS for the iframe
 * @param {Object} [props.wrapperStyle={}] - CSS for the container div
 * @param {string} [props.className] - CSS class for container
 * @param {string} [props.sandbox] - Iframe sandbox permissions
 * @param {boolean} [props.allowFullscreen=false] - Enable fullscreen mode
 * 
 * @example
 * // Full screen in a page
 * <AvatarStudioFrame />
 * 
 * @example
 * // Custom size with styling
 * <AvatarStudioFrame
 *   width="800px"
 *   height="600px"
 *   wrapperStyle={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
 * />
 * 
 * @example
 * // In a modal or dashboard
 * <AvatarStudioFrame width="90%" height="500px" />
 */
export function AvatarStudioFrame({
  src = '/avatar-studio/public/legacy.html',
  title = 'Avatar Studio',
  width = '100%',
  height = '100%',
  style = {},
  wrapperStyle = {},
  className = '',
  sandbox,
  allowFullscreen = false,
}) {
  const normalizeSize = (size) => {
    if (typeof size === 'number') return `${size}px`;
    return size;
  };

  const iframeWidth = normalizeSize(width);
  const iframeHeight = normalizeSize(height);

  return (
    <div
      className={className}
      style={{
        width: iframeWidth,
        height: iframeHeight,
        overflow: 'hidden',
        ...wrapperStyle,
      }}
    >
      <iframe
        title={title}
        src={src}
        style={{
          width: '100%',
          height: '100%',
          border: '0',
          display: 'block',
          ...style,
        }}
        sandbox={sandbox}
        allowFullScreen={allowFullscreen}
      />
    </div>
  );
}
