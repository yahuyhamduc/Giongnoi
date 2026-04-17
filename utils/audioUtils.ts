import * as lamejs from 'lamejs';

// Helper function to write a string to a DataView
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Creates a WAV header for raw PCM data.
 * @param dataLength The length of the PCM data in bytes.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param numChannels The number of channels (e.g., 1 for mono).
 * @param bitsPerSample The number of bits per sample (e.g., 16).
 * @returns A Uint8Array containing the WAV header.
 */
function createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true); // chunkSize
    writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // audioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // numChannels
    view.setUint32(24, sampleRate, true); // sampleRate
    view.setUint32(28, byteRate, true); // byteRate
    view.setUint16(32, blockAlign, true); // blockAlign
    view.setUint16(34, bitsPerSample, true); // bitsPerSample
    
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true); // subchunk2Size

    return new Uint8Array(buffer);
}

/**
 * Converts a base64 string of raw PCM audio data into a Blob representing a complete WAV file.
 * @param base64 The base64 encoded string of raw PCM data.
 * @returns A Blob object with MIME type 'audio/wav'.
 */
export const createWavBlob = (base64: string): Blob => {
  try {
    const byteCharacters = atob(base64);
    const pcmData = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      pcmData[i] = byteCharacters.charCodeAt(i);
    }
    
    // Gemini TTS provides raw PCM data at 24000 Hz, 16-bit, mono
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    
    const header = createWavHeader(pcmData.length, sampleRate, numChannels, bitsPerSample);
    
    // Combine header and PCM data to create a full WAV file
    return new Blob([header, pcmData], { type: 'audio/wav' });

  } catch (e) {
    console.error("Failed to decode base64 string or create WAV blob:", e);
    // Return an empty blob if processing fails
    return new Blob([], { type: 'audio/wav' });
  }
};

/**
 * Converts a base64 string of raw PCM audio data into a Blob representing an MP3 file.
 * @param base64 The base64 encoded string of raw PCM data.
 * @returns A Blob object with MIME type 'audio/mpeg'.
 */
export const createMp3Blob = (base64: string): Blob => {
  try {
    const byteCharacters = atob(base64);
    const pcmData = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      pcmData[i] = byteCharacters.charCodeAt(i);
    }

    // Gemini TTS provides raw PCM data at 24000 Hz, 16-bit, mono
    const sampleRate = 24000;
    const numChannels = 1;

    // Convert PCM Uint8Array to Int16Array for the encoder
    const pcmInt16 = new Int16Array(pcmData.buffer);

    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128); // 128 kbps
    const mp3Data = [];

    const sampleBlockSize = 1152; // Recommended block size for LAME
    for (let i = 0; i < pcmInt16.length; i += sampleBlockSize) {
        const sampleChunk = pcmInt16.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }
    }

    const mp3buf = mp3encoder.flush(); // Flush remaining data
    if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
    }
    
    return new Blob(mp3Data, { type: 'audio/mpeg' });

  } catch (e) {
    console.error("Failed to decode base64 string or create MP3 blob:", e);
    return new Blob([], { type: 'audio/mpeg' });
  }
};
