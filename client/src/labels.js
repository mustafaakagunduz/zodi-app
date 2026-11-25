export const find = (list, id) => list.find((item) => item.id === id);

// ︎: burç sembolü emoji yerine yazı karakteri olarak çizilsin.
export const symbolOf = (meta, signId) => `${find(meta.signs, signId).symbol}︎`;
