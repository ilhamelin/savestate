import Image from 'next/image';
import Link from 'next/link';
export function TrackerUidTags({
  genshinUid,
  hsrUid,
}: {
  genshinUid: string | null;
  hsrUid: string | null;
}) {
  return (
    <>
      {(
        [
          ['genshin', 'Genshin UID', genshinUid],
          ['hsr', 'HSR UID', hsrUid],
        ] as const
      ).map(([game, label, uid]) =>
        uid && /^\d{9,10}$/.test(uid) ? (
          <Link
            key={game}
            className="tag tracker-uid-tag"
            href={`/rift?${new URLSearchParams({ game, uid })}`}
          >
            <Image src={`/icons/games/${game}.png`} width={16} height={16} alt="" unoptimized />
            {label}: {uid} ↗
          </Link>
        ) : null,
      )}
    </>
  );
}
