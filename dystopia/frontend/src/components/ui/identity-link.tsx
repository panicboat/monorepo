import Image from "next/image";
import Link from "next/link";

export interface IdentityLinkProps {
  username: string;
  avatarUrl: string;
}

export function IdentityLink({ username, avatarUrl }: IdentityLinkProps) {
  const avatar = avatarUrl ? (
    <Image src={avatarUrl} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
  ) : (
    <div className="size-8 rounded-full bg-muted" />
  );

  if (!username) {
    return (
      <span className="flex items-center gap-2">
        {avatar}
        <span className="font-medium">(退会済)</span>
      </span>
    );
  }

  return (
    <Link href={`/u/${encodeURIComponent(username)}`} className="flex items-center gap-2 hover:underline">
      {avatar}
      <span className="font-medium">{username}</span>
    </Link>
  );
}
