/**
 * Profile Photo Upload Utility
 * Handles compression and upload of profile photos to Supabase Storage
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Compress an image (base64 or File) to max dimensions & quality
 */
export const compressImage = (
    source: string | File,
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.75
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        const loadImage = (src: string) => {
            img.src = src;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Scale down proportionally
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context failed'));
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Image load failed'));
        };

        if (typeof source === 'string') {
            loadImage(source);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => loadImage(e.target?.result as string);
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(source);
        }
    });
};

/**
 * Upload a profile photo to Supabase storage
 * Files are stored under `{userId}/{timestamp}.jpg` for RLS isolation
 */
export const uploadProfilePhoto = async (
    userId: string,
    source: string | File
): Promise<string | null> => {
    try {
        const blob = await compressImage(source);
        const filePath = `${userId}/${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
            .from('profile-photos')
            .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'image/jpeg',
            });

        if (error) throw error;

        const {
            data: { publicUrl },
        } = supabase.storage.from('profile-photos').getPublicUrl(data.path);

        return publicUrl;
    } catch (err) {
        console.error('Profile photo upload failed:', err);
        return null;
    }
};

/**
 * Update the user's avatar_url in the profiles table
 */
export const saveAvatarUrl = async (
    userId: string,
    avatarUrl: string
): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Save avatar URL failed:', err);
        return false;
    }
};

/**
 * Convert a File to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
};
