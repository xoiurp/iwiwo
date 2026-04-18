'use client';

import { useState, useRef } from 'react';
import { adminFetch } from '../lib/auth';

export interface ImageItem {
  url: string;
  position: number;
  is_principal: boolean;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  productId?: number;
  maxImages?: number;
}

export default function ImageUploader({
  images,
  onChange,
  productId,
  maxImages = 5,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!productId) {
      setError('Salve o produto antes de enviar imagens.');
      return null;
    }

    const res = await adminFetch('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        productId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao gerar URL de upload');
    }

    const { uploadUrl, publicUrl } = await res.json();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadRes.ok) {
      throw new Error('Erro ao enviar arquivo para R2');
    }

    return publicUrl;
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;

    if (remaining <= 0) {
      setError(`Limite de ${maxImages} imagens atingido.`);
      return;
    }

    const toUpload = fileArray.slice(0, remaining);
    setError('');
    setUploading(true);

    try {
      const newImages: ImageItem[] = [];

      for (const file of toUpload) {
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} excede 5MB.`);
          continue;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setError(`${file.name}: tipo nao permitido.`);
          continue;
        }

        const url = await uploadFile(file);
        if (url) {
          newImages.push({
            url,
            position: images.length + newImages.length,
            is_principal: images.length === 0 && newImages.length === 0,
          });
        }
      }

      if (newImages.length > 0) {
        onChange([...images, ...newImages]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleRemove(index: number) {
    const updated = images.filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, position: i }));
    if (updated.length > 0 && !updated.some(i => i.is_principal)) {
      updated[0].is_principal = true;
    }
    onChange(updated);
  }

  function handleSetPrincipal(index: number) {
    const updated = images.map((img, i) => ({
      ...img,
      is_principal: i === index,
    }));
    onChange(updated);
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOverItem(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...images];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    const reordered = updated.map((img, i) => ({ ...img, position: i }));
    onChange(reordered);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '10px',
          padding: '32px',
          textAlign: 'center',
          cursor: images.length >= maxImages ? 'not-allowed' : 'pointer',
          backgroundColor: dragOver ? '#eff6ff' : '#fafafa',
          transition: 'all 0.15s',
          opacity: images.length >= maxImages ? 0.5 : 1,
          marginBottom: '16px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={images.length >= maxImages}
        />
        {uploading ? (
          <div style={{ color: '#2563eb', fontWeight: 500 }}>Enviando...</div>
        ) : (
          <div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              Arraste imagens aqui ou clique para selecionar
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              JPEG, PNG ou WebP - max 5MB - {images.length}/{maxImages} fotos
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          color: '#dc2626', fontSize: '13px', marginBottom: '12px',
          padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px',
        }}>
          {error}
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '12px',
        }}>
          {images.map((img, i) => (
            <div
              key={img.url}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOverItem(e, i)}
              onDragEnd={handleDragEnd}
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: img.is_principal ? '2px solid #2563eb' : '2px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                cursor: 'grab',
                aspectRatio: '1',
              }}
            >
              <img
                src={img.url}
                alt={`Foto ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {/* Principal badge */}
              <button
                type="button"
                onClick={() => handleSetPrincipal(i)}
                title={img.is_principal ? 'Imagem principal' : 'Definir como principal'}
                style={{
                  position: 'absolute', top: 4, left: 4,
                  background: img.is_principal ? '#2563eb' : 'rgba(0,0,0,0.5)',
                  color: '#fff', border: 'none', borderRadius: '4px',
                  width: 24, height: 24, cursor: 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {img.is_principal ? '\u2605' : '\u2606'}
              </button>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                title="Remover"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(220,38,38,0.85)', color: '#fff',
                  border: 'none', borderRadius: '4px',
                  width: 24, height: 24, cursor: 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                &times;
              </button>
              {/* Position indicator */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                borderRadius: '4px', padding: '2px 6px', fontSize: '11px',
              }}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
