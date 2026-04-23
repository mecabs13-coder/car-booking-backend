const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Function to dynamically set destination directory
const getDestination = (destinationDir) => {
    return (req, file, cb) => {
        const uploadDir = `public/uploads/${destinationDir.toLowerCase()}`;
        // Check if the directory exists, if not, create it
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    };
};

const resolveFileNameConflict = (destinationDir, originalName) => {
    const ext = path.extname(originalName); // Get file extension
    const baseName = path.basename(originalName, ext); // Get the base name without extension
    let fileName = originalName;
    let counter = 1;

    // Check if a file with the same name already exists
    while (fs.existsSync(path.join(destinationDir, fileName))) {
        fileName = `${baseName}-${counter}${ext}`; // Append a number to the file name
        counter++;
    }

    return fileName;
};

// Multer disk storage configuration
const storage = (destinationDir) => multer.diskStorage({
    destination: getDestination(destinationDir),
    filename: (req, file, cb) => {
        const originalName = file.originalname;
        const finalFileName = resolveFileNameConflict(`public/uploads/${destinationDir.toLowerCase()}`, originalName);
        cb(null, finalFileName); // Set the final resolved file name
    }
});

const singleUpload = (destinationDir, fieldname) => multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 } // Set maximum file size (e.g., 10MB)
}).single(fieldname || 'image');

const twoUploads = (destinationDir, fieldsObj) => multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 }
}).fields(
    Object.entries(fieldsObj).map(([name, maxCount]) => ({ name, maxCount }))
);

const multiupload = (destinationDir, fieldname) => multer({
    storage: storage(destinationDir),
    limits: { fileSize: 1024 * 1024 * 40 } // Set maximum file size (e.g., 10MB)
}).array(fieldname || 'images');

module.exports = {
    singleUpload,
    twoUploads,
    multiupload
}