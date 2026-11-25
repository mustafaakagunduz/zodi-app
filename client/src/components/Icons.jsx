// Çizgi ikonlar; rengi düğmenin yazı renginden alır.
const Icon = ({ children, size = 20 }) => (
  <svg
    viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
  >
    {children}
  </svg>
);

export const BlockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);

// Alt menü ikonları.
export const MailIcon = () => (
  <Icon size={24}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M4 7.5l8 6 8-6" />
  </Icon>
);

export const ChatIcon = () => (
  <Icon size={24}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.8A8 8 0 1 1 21 12z" />
  </Icon>
);

export const UserIcon = () => (
  <Icon size={24}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const FilterIcon = () => (
  <Icon>
    <path d="M3 5h18l-7 8v6l-4-2v-4z" />
  </Icon>
);

export const RefreshIcon = () => (
  <Icon>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon size={24}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);
