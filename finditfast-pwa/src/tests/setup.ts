// Test setup file
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock DOM globals
global.HTMLElement = global.HTMLElement || class {};
global.HTMLImageElement = global.HTMLImageElement || class {};
global.HTMLDivElement = global.HTMLDivElement || class {};

// Mock URL.createObjectURL
global.URL = global.URL || {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
};

// Mock FileReader
global.FileReader = global.FileReader || class FileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<EventTarget>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<EventTarget>) => any) | null = null;
  
  readAsDataURL(_file: Blob) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mock-data';
      if (this.onload) {
        this.onload({} as ProgressEvent<EventTarget>);
      }
    }, 0);
  }
};

// Mock Canvas and Image
global.HTMLCanvasElement = global.HTMLCanvasElement || class HTMLCanvasElement {
  width = 0;
  height = 0;
  
  getContext() {
    return {
      drawImage: vi.fn(),
    };
  }
  
  toBlob(callback: BlobCallback) {
    const blob = new Blob(['mock'], { type: 'image/jpeg' });
    setTimeout(() => callback(blob), 0);
  }
};

global.Image = global.Image || class Image {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  
  set src(_value: string) {
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
};

// Mock global environment variables
global.process = global.process || {};
global.process.env = global.process.env || {};

// Mock document for React DOM
if (typeof document === 'undefined') {
  global.document = {
    createElement: vi.fn(() => ({})),
    createTextNode: vi.fn(() => ({})),
    getElementById: vi.fn(() => null),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as any;
}

// Mock window for React DOM
if (typeof window === 'undefined') {
  global.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { href: 'http://localhost:3000' },
    navigator: { userAgent: 'test' },
  } as any;
}

// Mock navigator.userAgent
Object.defineProperty(window.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  writable: true,
});

// Mock Firebase
vi.mock('../services/authService', () => ({
  AuthService: {
    onAuthStateChanged: vi.fn(() => vi.fn()),
    signOut: vi.fn(),
  },
}));

// Mock service worker
Object.defineProperty(window, 'navigator', {
  value: {
    ...window.navigator,
    serviceWorker: {
      register: vi.fn(() => Promise.resolve({
        addEventListener: vi.fn(),
        update: vi.fn(),
      })),
      ready: Promise.resolve({
        addEventListener: vi.fn(),
        update: vi.fn(),
      }),
    },
  },
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Touch events
global.Touch = global.Touch || class Touch {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
  
  constructor(touchInit: TouchInit) {
    this.identifier = touchInit.identifier;
    this.target = touchInit.target;
    this.clientX = touchInit.clientX || 0;
    this.clientY = touchInit.clientY || 0;
  }
};

global.TouchEvent = global.TouchEvent || class TouchEvent extends Event {
  touches: TouchList;
  
  constructor(type: string, eventInit: TouchEventInit = {}) {
    super(type, eventInit);
    this.touches = eventInit.touches || ([] as any);
  }
};