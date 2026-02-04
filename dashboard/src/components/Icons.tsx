// Custom SVG Icons for McServer
// These replace emojis for a more professional, app-like appearance

export const GamepadIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
    <circle cx="17" cy="10" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const SyncIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

export const GlobeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const PackageIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const SaveIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const PartyIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.8 11.3 2 22l10.7-3.79" />
    <path d="M4 3h.01" />
    <path d="M22 8h.01" />
    <path d="M15 2h.01" />
    <path d="M22 20h.01" />
    <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
    <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17" />
    <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7" />
    <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
  </svg>
);

export const FabricIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5L18 8v8l-6 3-6-3V8l6-3.5z" />
    <path d="M12 7v10M7 9.5v5M17 9.5v5" />
  </svg>
);

export const ForgeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export const VanillaIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

export const SparklesIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

export const WindowsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
);

export const AppleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

export const LinuxIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 0 0-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 0 1-.004-.021l-.004-.024a1.807 1.807 0 0 1-.15.706.953.953 0 0 1-.213.335.71.71 0 0 0-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 0 1-.22-.253 1.34 1.34 0 0 1-.106-.199c-.058-.135-.107-.3-.151-.457l-.013-.045-.01-.04c-.005-.02-.01-.038-.012-.054l-.006-.028-.006-.028a.296.296 0 0 0-.013-.06l-.014-.066-.014-.075c-.005-.028-.01-.058-.013-.088l-.012-.09-.007-.058-.003-.032c-.005-.04-.009-.08-.01-.112v-.037l-.002-.03c-.003-.032-.002-.062-.002-.09v-.098c0-.02.002-.04.002-.058v-.035l.001-.018c.005-.07.015-.14.03-.202.016-.065.038-.127.068-.18a.544.544 0 0 1 .12-.153.3.3 0 0 1 .18-.062zm-1.7.13c.088 0 .166.015.236.046a.493.493 0 0 1 .168.126c.047.053.083.116.11.19.028.073.044.155.044.245 0 .022 0 .045-.003.068a.877.877 0 0 1-.012.09l-.006.035-.007.04-.01.04-.012.052c-.01.037-.019.075-.03.11l-.02.062-.022.062-.023.06-.024.062a.588.588 0 0 1-.024.058l-.022.046-.022.043a1.09 1.09 0 0 1-.054.092c-.02.03-.039.06-.06.088l-.063.08a.964.964 0 0 1-.12.122 1.04 1.04 0 0 1-.102.082.74.74 0 0 1-.07.045 1.452 1.452 0 0 1-.096-.282 2.014 2.014 0 0 1-.044-.347l-.002-.08v-.041c0-.022 0-.045.002-.068a.76.76 0 0 1 .028-.19.568.568 0 0 1 .078-.172.407.407 0 0 1 .132-.125.35.35 0 0 1 .19-.05zm3.346 2.34c-.074.004-.14.015-.206.037l.018.067.015.063.013.063.012.063.01.06.01.058.007.058.006.055.005.053.004.052.003.048.002.047.002.045.001.042v.038a1.1 1.1 0 0 1-.007.133 1.15 1.15 0 0 1-.028.16.84.84 0 0 1-.049.147.62.62 0 0 1-.075.13.547.547 0 0 1-.1.106.458.458 0 0 1-.13.077.323.323 0 0 1-.158.032.284.284 0 0 1-.13-.028.331.331 0 0 1-.104-.086.447.447 0 0 1-.07-.123.702.702 0 0 1-.04-.156.98.98 0 0 1-.012-.173c0-.07.006-.14.018-.203a.8.8 0 0 1 .05-.177.53.53 0 0 1 .086-.145.406.406 0 0 1 .125-.098.377.377 0 0 1 .168-.035c.074 0 .14.016.195.046a.42.42 0 0 1 .137.127.65.65 0 0 1 .085.188.91.91 0 0 1 .036.223v.025l.002.025v.023c0 .03-.002.058-.006.085a.746.746 0 0 1-.018.098.474.474 0 0 1-.033.096.345.345 0 0 1-.048.08.238.238 0 0 1-.07.057.163.163 0 0 1-.09.022.164.164 0 0 1-.098-.031.264.264 0 0 1-.067-.08.404.404 0 0 1-.041-.108.76.76 0 0 1-.015-.121v-.018c0-.013 0-.026.002-.04l.002-.036.003-.033c.003-.022.005-.043.01-.063l.011-.055a.548.548 0 0 1 .016-.052l.02-.05.023-.048c.008-.015.019-.03.03-.046l.034-.04a.296.296 0 0 1 .04-.035c.015-.01.032-.02.05-.028a.223.223 0 0 1 .057-.016.178.178 0 0 1 .062.002c.057.008.102.04.133.09a.37.37 0 0 1 .05.143c.006.035.01.07.01.107v.032c0 .016 0 .03-.002.045a.357.357 0 0 1-.024.11.238.238 0 0 1-.052.082.168.168 0 0 1-.082.046.125.125 0 0 1-.105-.019.145.145 0 0 1-.052-.079.243.243 0 0 1-.013-.099c.002-.025.006-.048.016-.067l.022-.043a.104.104 0 0 1 .058-.046.092.092 0 0 1 .078.01.075.075 0 0 1 .034.064c0 .02-.006.038-.02.052a.066.066 0 0 1-.048.02.052.052 0 0 1-.042-.017.043.043 0 0 1-.012-.037c.001-.012.007-.02.018-.026a.03.03 0 0 1 .027-.001c.005.003.008.008.01.013a.02.02 0 0 1-.003.015.014.014 0 0 1-.01.005.011.011 0 0 1-.008-.002l-.003-.004-.002-.003v.002l.002.002.005.004.008.003.011.001h.015l.018-.006.019-.012.017-.016.015-.023.01-.027.006-.033.002-.036v-.017l-.003-.038-.008-.035-.015-.03-.02-.024-.024-.02a.137.137 0 0 0-.032-.015.18.18 0 0 0-.043-.009.21.21 0 0 0-.1.015.266.266 0 0 0-.083.052.367.367 0 0 0-.07.085.56.56 0 0 0-.053.117.74.74 0 0 0-.034.143 1.11 1.11 0 0 0-.009.158c.002.06.012.12.028.174a.51.51 0 0 0 .063.145.35.35 0 0 0 .1.1.287.287 0 0 0 .137.042.28.28 0 0 0 .153-.035.38.38 0 0 0 .116-.098.553.553 0 0 0 .078-.143.8.8 0 0 0 .043-.169.906.906 0 0 0 .008-.178.856.856 0 0 0-.032-.195.657.657 0 0 0-.077-.17.49.49 0 0 0-.124-.133.44.44 0 0 0-.173-.077.394.394 0 0 0-.21 0 .477.477 0 0 0-.188.09.637.637 0 0 0-.15.168.858.858 0 0 0-.098.237 1.04 1.04 0 0 0-.032.282c.002.1.02.196.055.285a.81.81 0 0 0 .125.225.65.65 0 0 0 .185.157.52.52 0 0 0 .232.066.498.498 0 0 0 .252-.05.66.66 0 0 0 .2-.152.9.9 0 0 0 .146-.23 1.1 1.1 0 0 0 .084-.283 1.26 1.26 0 0 0 .017-.31 1.14 1.14 0 0 0-.056-.31 1.03 1.03 0 0 0-.124-.252.85.85 0 0 0-.188-.192.69.69 0 0 0-.243-.115.61.61 0 0 0-.285-.014.673.673 0 0 0-.26.1.825.825 0 0 0-.202.195.967.967 0 0 0-.133.267 1.088 1.088 0 0 0-.05.317c0 .128.022.253.068.37.045.118.11.224.195.315a.943.943 0 0 0 .296.218.93.93 0 0 0 .378.09 1 1 0 0 0 .393-.068c.12-.05.226-.12.317-.21a1.27 1.27 0 0 0 .222-.32c.058-.122.098-.252.12-.385a1.57 1.57 0 0 0 .018-.427 1.42 1.42 0 0 0-.108-.41 1.2 1.2 0 0 0-.215-.337 1.02 1.02 0 0 0-.312-.233.938.938 0 0 0-.398-.097z" />
  </svg>
);

export const MonitorIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const LockIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const ListIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export const ChartIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const SettingsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ComputerIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const SignalIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h.01" />
    <path d="M7 20v-4" />
    <path d="M12 20v-8" />
    <path d="M17 20V8" />
    <path d="M22 4v16" />
  </svg>
);
