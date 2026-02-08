interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpeaking?: boolean;
  audioLevel?: number; // 0-1 arasi ses seviyesi
  showAudioLevel?: boolean;
  className?: string;
}

export function Avatar({
  src,
  name,
  size = 'md',
  isSpeaking,
  audioLevel = 0,
  showAudioLevel = false,
  className = ''
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  const ringSize = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent color based on the name
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
  ];
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const bgColor = colors[colorIndex];

  // Dinamik ring opasitesi ses seviyesine gore
  const ringOpacity = isSpeaking ? Math.max(0.5, audioLevel) : 0;
  const ringScale = isSpeaking ? 1 + (audioLevel * 0.2) : 1;

  const avatarContent = src ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className={`${sizes[size]} rounded-full object-cover relative z-10`}
      onError={(e) => {
        // Fallback to initials if image fails to load
        (e.target as HTMLImageElement).style.display = 'none';
        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
      }}
    />
  ) : null;

  const initialsContent = (
    <div
      className={`${sizes[size]} ${bgColor} rounded-full flex items-center justify-center font-medium text-white relative z-10 ${src ? 'hidden' : ''}`}
    >
      {initials}
    </div>
  );

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Animated speaking ring */}
      {isSpeaking && (
        <>
          {/* Outer pulsing ring */}
          <div
            className={`absolute ${ringSize[size]} rounded-full bg-green-500 animate-speaking-ring`}
            style={{ opacity: ringOpacity * 0.3 }}
          />
          {/* Inner glow ring */}
          <div
            className={`absolute ${sizes[size]} rounded-full border-4 border-green-500 animate-speaking-pulse`}
            style={{
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
              transition: 'transform 0.1s ease-out'
            }}
          />
        </>
      )}

      {avatarContent}
      {initialsContent}

      {/* Audio level indicator bars */}
      {showAudioLevel && isSpeaking && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 bg-green-500 rounded-full audio-wave-bar"
              style={{
                height: `${Math.max(4, audioLevel * 12)}px`,
                animationDelay: `${i * 0.15}s`,
                opacity: audioLevel > 0.1 ? 1 : 0.3
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
