// utils/svgHelpers.ts
export const normalizeSvg = (svgContent: string): string => {
  if (!svgContent) return '';
  let svg = svgContent;
  
  const hasViewBox = /viewBox=["'][^"']*["']/.test(svg);
  if (!hasViewBox) {
    const widthMatch = svg.match(/width=["']([0-9.]+)/);
    const heightMatch = svg.match(/height=["']([0-9.]+)/);
    if (widthMatch && heightMatch) {
      svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}"`);
    } else {
      svg = svg.replace(/<svg/i, `<svg viewBox="0 0 800 600"`);
    }
  }
  
  return svg.replace(/<svg/i, `<svg style="width:100%; height:auto; max-width:100%;"`);
};

export const getViewBox = (svgContent: string) => {
  const match = svgContent.match(/viewBox=["']([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)["']/);
  return match ? {
    x: parseFloat(match[1]), y: parseFloat(match[2]),
    width: parseFloat(match[3]), height: parseFloat(match[4])
  } : { x: 0, y: 0, width: 800, height: 600 };
};