type AvatarProps = {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}

function getColorIndex(name: string | null | undefined): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 1000;
  }
  return hash % 5;
}

const sizeClass = {
  sm: "avatar-sm",
  md: "avatar-md",
  lg: "avatar-lg"
};

export function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <span
      className={`avatar ${sizeClass[size]}`}
      data-tone={getColorIndex(name)}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
