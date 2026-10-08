'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Post } from '@/domain/highlights';
import { PostForm } from './post-form';
export function PostEditor({ post }: { post: Post }) {
  // Pin the version at opening: a refresh must not silently overwrite a dirty edit.
  const [snapshot, setSnapshot] = useState<Post | null>(null);
  return snapshot ? (
    <PostForm userId={post.user_id} initialPost={snapshot} onDone={() => setSnapshot(null)} />
  ) : (
    <button type="button" className="button outline small" onClick={() => setSnapshot(post)}>
      <Pencil size={14} aria-hidden="true" /> Editar
    </button>
  );
}
