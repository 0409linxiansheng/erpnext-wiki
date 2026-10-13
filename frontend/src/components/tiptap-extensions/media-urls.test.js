import assert from 'node:assert/strict';
import test from 'node:test';

import {
	extOf,
	getFileKind,
	isAttachmentUrl,
	isAudioUrl,
	isImageUrl,
	isTextUrl,
	isVideoUrl,
} from './media-urls.js';

test('extOf strips query/fragment and lowercases', () => {
	assert.equal(extOf('/files/a.TXT'), '.txt');
	assert.equal(extOf('/files/a.zip?download=1'), '.zip');
	assert.equal(extOf('/files/a.py#L3'), '.py');
	assert.equal(extOf('/files/noext'), '');
});

test('classifies the media types the existing nodes own', () => {
	assert.equal(isImageUrl('/files/a.png'), true);
	assert.equal(isImageUrl('/files/a.svg'), true);
	assert.equal(isVideoUrl('/files/a.mp4'), true);
	assert.equal(isAudioUrl('/files/a.mp3'), true);
	assert.equal(isTextUrl('/files/a.py'), true);
});

test('an attachment is a non-media URL with an extension', () => {
	assert.equal(isAttachmentUrl('/files/notes.txt'), true);
	assert.equal(isAttachmentUrl('/files/audio.mp3'), true);
	assert.equal(isAttachmentUrl('/files/archive.zip'), true);
	// media + extensionless are not attachments
	assert.equal(isAttachmentUrl('/files/a.png'), false);
	assert.equal(isAttachmentUrl('/files/a.mp4'), false);
	assert.equal(isAttachmentUrl('/files/a.pdf'), false);
	assert.equal(isAttachmentUrl('/assets/brandmark'), false);
});

test('getFileKind routes to the render kind', () => {
	assert.equal(getFileKind('/files/a.png'), 'image');
	assert.equal(getFileKind('/files/a.mp4'), 'video');
	assert.equal(getFileKind('/files/a.pdf'), 'pdf');
	assert.equal(getFileKind('/files/a.mp3'), 'audio');
	assert.equal(getFileKind('/files/a.toml'), 'text');
	assert.equal(getFileKind('/files/a.zip'), 'file');
	assert.equal(getFileKind('/assets/brandmark'), null);
});
