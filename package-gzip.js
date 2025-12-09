import targz from 'targz';
import fs from 'fs';

const DEST = 'file-uploader.tar.gz';
const SRC = 'dist';

if (!fs.existsSync(SRC)) {
    console.error(`Source folder "${SRC}" does not exist. Build first!`);
    process.exit(1);
}

// Remove existing archive
if (fs.existsSync(DEST)) {
    fs.unlinkSync(DEST);
    console.log(`Removed existing archive: ${DEST}`);
}

console.log(`Creating archive from "${SRC}" → ${DEST}...`);

targz.compress({
    src: SRC,
    dest: DEST,
}, (err) => {
    if (err) {
        console.error('Packaging failed:', err);
        process.exit(1);
    } else {
        console.log(`Packaging complete: ${DEST}`);
    }
});