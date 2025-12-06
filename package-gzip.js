const targz = require("targz");
const { execSync } = require("child_process");
const fs = require("fs");

try {
    console.log("Installing production dependencies...");
    execSync("npm ci --only=production", { stdio: "inherit" });

    if (fs.existsSync("file-uploader.tar.gz")) {
        fs.unlinkSync("file-uploader.tar.gz");
    }

    console.log("Creating package archive...");

    targz.compress(
        {
            src: ".",
            dest: "file-uploader.tar.gz",
            tar: {
                entries: [
                    "dist",
                    "node_modules",
                    "package.json",
                    "package-lock.json"
                ]
            }
        },
        (err) => {
            if (err) {
                console.error("Packaging error:", err);
            } else {
                console.log("Packaging complete: file-uploader.tar.gz");
            }
        }
    );
} catch (err) {
    console.error("Error preparing package:", err);
}