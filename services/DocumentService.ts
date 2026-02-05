
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface FileUploadResult {
    success: boolean;
    data?: string; // base64 data
    name?: string;
    error?: string;
}

/**
 * Validate file type and size
 */
function validateFile(file: File, allowedTypes: string[]): { valid: boolean; error?: string } {
    // Check file type
    const fileType = file.type;
    if (!allowedTypes.includes(fileType)) {
        return {
            valid: false,
            error: `Ungültiger Dateityp. Erlaubt: ${allowedTypes.join(', ')}`
        };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `Datei zu groß. Maximum: ${MAX_FILE_SIZE_MB}MB`
        };
    }

    return { valid: true };
}

/**
 * Convert file to base64 string
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsDataURL(file);
    });
}

class DocumentService {
    /**
     * Upload a profile image (jpg/png)
     */
    async uploadProfileImage(file: File): Promise<FileUploadResult> {
        const validation = validateFile(file, ['image/jpeg', 'image/png', 'image/webp']);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const data = await fileToBase64(file);
            return { success: true, data, name: file.name };
        } catch (e) {
            return { success: false, error: 'Bild-Upload fehlgeschlagen.' };
        }
    }

    /**
     * Upload a PDF document
     */
    async uploadPdf(file: File): Promise<FileUploadResult> {
        const validation = validateFile(file, ['application/pdf']);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const data = await fileToBase64(file);
            return { success: true, data, name: file.name };
        } catch (e) {
            return { success: false, error: 'PDF-Upload fehlgeschlagen.' };
        }
    }

    /**
     * Upload multiple PDF files
     */
    async uploadMultiplePdfs(files: FileList): Promise<{ name: string; data: string }[]> {
        const results: { name: string; data: string }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = await this.uploadPdf(file);
            if (result.success && result.data && result.name) {
                results.push({ name: result.name, data: result.data });
            }
        }

        return results;
    }

    /**
     * Check if a data URL is valid
     */
    isValidDataUrl(url: string): boolean {
        return url.startsWith('data:');
    }

    /**
     * Get file size from base64 (approximate)
     */
    getBase64Size(base64: string): number {
        // Remove data URL prefix if present
        const base64Data = base64.split(',')[1] || base64;
        // Calculate approximate size: base64 is ~4/3 larger than original
        return Math.round((base64Data.length * 3) / 4);
    }
}

export const documentService = new DocumentService();
