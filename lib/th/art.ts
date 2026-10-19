// Event phone art (nothing secret: frame, wallpaper, crack, game backgrounds), as phone-sized webp in public/m/.
// Location pictures never live here: they come only from the API.
// The boxes below say where things sit inside the pictures, in percent; a new picture only needs new boxes.

export const ART = {
  frame: "/m/frame.webp",
  wallpaper: "/m/wall.webp",
  crack: "/m/crack.webp",
  start: "/m/start.webp",
  tuner: "/m/tuner.webp",
  knob: "/m/knob.webp",
  polaroid: "/m/polaroid.webp",
  tray: "/m/tray.webp",
  vial: "/m/vial.webp",
  panel: "/m/panel.webp",
  paper: "/m/paper.webp",
};

// The dark screen inside frame.webp (left, top, width, height); the app is drawn on top of it
export const FRAME_SCREEN = { left: 20.31, top: 13.28, width: 59.38, height: 69.14 };

// polaroid.webp is cut to the visible frame, 1010 x 1239 (width / height)
export const POLAROID_ASPECT = "1010 / 1239";
// Its photo hole is 855 x 802 px, nearly square: the whole hole gets a dark backing (POLAROID_BACK) and the square
// photo sits in the middle of it (POLAROID_HOLE, the biggest square that fits)
export const POLAROID_BACK = { left: 7.82, top: 14.29, width: 84.65, height: 64.73 };
export const POLAROID_HOLE = { left: 10.45, top: 14.29, width: 79.41, height: 64.73 };

// vial.webp is cut tight around the tube (239 x 1200); the liquid fills this box inside the glass
export const VIAL_ASPECT = "239 / 1200";
export const VIAL_LIQUID = { left: 25, top: 9, width: 57, height: 86.5 };
