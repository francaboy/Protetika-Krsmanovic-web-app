import { useState } from "react";
import { cn, initials, colorFromId } from "../../lib/utils";

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

const Avatar = ({ name, id, src, size = "md", className, title }) => {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(src && !imgError);

  return (
    <div
      title={title || name}
      className={cn(
        "flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-surface",
        sizeMap[size] || sizeMap.md,
        className
      )}
      style={{ backgroundColor: showImage ? undefined : colorFromId(id || name || "") }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || "Korisnik"}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </div>
  );
};

export const AvatarStack = ({ users = [], max = 4, size = "sm" }) => {
  const shown = users.slice(0, max);
  const extraUsers = users.slice(max);
  const extra = extraUsers.length;

  const extraTooltip = extraUsers.map((u) => u.name || "Korisnik").join(", ");

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u) => (
        <Avatar key={u.id} id={u.id} name={u.name} src={u.avatar_url} size={size} />
      ))}
      {extra > 0 && (
        <div
          title={extraTooltip}
          className={cn(
            "flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 font-medium text-muted ring-2 ring-surface tabular",
            sizeMap[size] || sizeMap.sm
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

export default Avatar;