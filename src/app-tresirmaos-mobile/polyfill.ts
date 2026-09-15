// polyfill.ts
// Polyfills essenciais para compatibilidade do runtime React Native / Web.

if (typeof global !== 'undefined' && !global.DOMException) {
  global.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  } as any;
}

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

if (typeof global !== 'undefined' && typeof (global as any).atob === 'undefined') {
  (global as any).atob = function (input: string): string {
    const str = String(input).replace(/=+$/, '');
    if (str.length % 4 === 1) {
      throw new Error('InvalidLengthError: The string to be decoded is not correctly encoded.');
    }
    let output = '';
    for (let bc = 0, bs = 0, buffer = 0, idx = 0; idx < str.length; idx++) {
      const bufferChar = str.charAt(idx);
      const charIndex = chars.indexOf(bufferChar);
      if (~charIndex) {
        bs = bc % 4 ? bs * 64 + charIndex : charIndex;
        if (bc++ % 4) {
          output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
      }
    }
    return output;
  };
}

if (typeof global !== 'undefined' && typeof (global as any).btoa === 'undefined') {
  (global as any).btoa = function (input: string): string {
    const str = String(input);
    let output = '';
    for (let block = 0, charCode, idx = 0, map = chars; str.charAt(idx | 0) || ((map = '='), idx % 1); output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))) {
      charCode = str.charCodeAt((idx += 3 / 4));
      if (charCode > 0xff) {
        throw new Error('InvalidCharacterError: String contains characters outside the Latin1 range.');
      }
      block = (block << 8) | charCode;
    }
    return output;
  };
}