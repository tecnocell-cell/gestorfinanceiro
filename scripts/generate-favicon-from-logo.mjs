import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, "..", "public");
const svgPath = path.join(pub, "favicon.svg");

const svg = fs.readFileSync(svgPath);
const iconBuf = await sharp(svg).resize(512, 512).png().toBuffer();

await sharp(iconBuf).resize(64, 64).png().toFile(path.join(pub, "fluxiva-icon.png"));
await sharp(iconBuf).resize(32, 32).png().toFile(path.join(pub, "favicon-32.png"));
await sharp(iconBuf).resize(16, 16).png().toFile(path.join(pub, "favicon-16.png"));
fs.copyFileSync(path.join(pub, "favicon-32.png"), path.join(pub, "favicon.ico"));

console.log("OK: favicons gerados a partir de favicon.svg (livreto Fluxiva)");
