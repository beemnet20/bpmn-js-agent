import PaletteModule from 'diagram-js/lib/features/palette'

class NullPaletteProvider {
  static $inject = ['palette']

  constructor(palette: { registerProvider(p: NullPaletteProvider): void }) {
    palette.registerProvider(this)
  }

  getPaletteEntries(): Record<string, never> {
    return {}
  }
}

const NullPaletteModule = {
  __depends__: [PaletteModule],
  __init__: ['nullPaletteProvider'],
  nullPaletteProvider: ['type', NullPaletteProvider],
  // Override the built-in provider with a no-op
  paletteProvider: ['type', NullPaletteProvider],
}

export default NullPaletteModule