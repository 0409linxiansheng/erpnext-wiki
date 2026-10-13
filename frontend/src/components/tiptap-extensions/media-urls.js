// Kept free of node view imports so markdown code and `node --test` can use it.

/**
 * Video extensions that should be rendered as video players
 */
export const VIDEO_EXTENSIONS = [
	'.mp4',
	'.webm',
	'.ogg',
	'.mov',
	'.avi',
	'.mkv',
	'.m4v',
];

/**
 * Check if a URL is a video URL based on file extension
 */
export function isVideoUrl(url) {
	if (!url) return false;
	const cleanUrl = String(url).split(/[?#]/)[0].toLowerCase();
	return VIDEO_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext));
}

/**
 * Check if a URL points to a PDF based on its file extension.
 */
export function isPdfUrl(url) {
	if (!url) return false;
	const cleanUrl = String(url).split(/[?#]/)[0].toLowerCase();
	return cleanUrl.endsWith('.pdf');
}

/**
 * Audio extensions rendered as a native player.
 */
export const AUDIO_EXTENSIONS = [
	'.mp3',
	'.wav',
	'.m4a',
	'.aac',
	'.flac',
	'.opus',
	'.oga',
	'.weba',
];

/**
 * Text/code extensions rendered as an inline preview. `.svg` is deliberately
 * absent: it is an image.
 */
export const TEXT_EXTENSIONS = [
	'.txt',
	'.md',
	'.markdown',
	'.csv',
	'.tsv',
	'.json',
	'.jsonl',
	'.yaml',
	'.yml',
	'.py',
	'.js',
	'.mjs',
	'.cjs',
	'.ts',
	'.jsx',
	'.tsx',
	'.css',
	'.scss',
	'.less',
	'.html',
	'.htm',
	'.xml',
	'.sh',
	'.bash',
	'.zsh',
	'.fish',
	'.sql',
	'.ini',
	'.toml',
	'.conf',
	'.log',
	'.diff',
	'.patch',
	'.rst',
	'.tex',
	'.bib',
	'.env',
	'.gitignore',
	'.dockerfile',
];

/**
 * Image extensions that keep their `<img>` rendering.
 */
export const IMAGE_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.svg',
	'.avif',
	'.ico',
	'.bmp',
];

/** Lowercased path extension without query/fragment, or "" when there is none. */
export function extOf(url) {
	if (!url) return '';
	const clean = String(url).split('?')[0].split('#')[0].toLowerCase();
	const base = clean.split('/').pop() || '';
	if (!base.includes('.')) return '';
	return `.${base.split('.').pop()}`;
}

export function isImageUrl(url) {
	return IMAGE_EXTENSIONS.includes(extOf(url));
}

export function isAudioUrl(url) {
	return AUDIO_EXTENSIONS.includes(extOf(url));
}

export function isTextUrl(url) {
	return TEXT_EXTENSIONS.includes(extOf(url));
}

/**
 * A non-image/video/pdf URL that still has a file extension is an attachment
 * (audio, text/code, or a generic download). Extensionless URLs stay images.
 */
export function isAttachmentUrl(url) {
	const ext = extOf(url);
	if (!ext) return false;
	return (
		!isImageUrl(url) && !isVideoUrl(url) && !isPdfUrl(url)
	);
}

/** The render kind for a file URL: image/video/pdf/audio/text/file, or null. */
export function getFileKind(url) {
	if (isImageUrl(url)) return 'image';
	if (isVideoUrl(url)) return 'video';
	if (isPdfUrl(url)) return 'pdf';
	if (isAudioUrl(url)) return 'audio';
	if (isTextUrl(url)) return 'text';
	if (extOf(url)) return 'file';
	return null;
}
