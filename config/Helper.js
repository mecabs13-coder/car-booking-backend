const path = require('path');
const fs = require('fs');

const deleteImageFile = (relativePath, imageName) => {
  return new Promise((resolve, reject) => {
    const imagePath = path.join(__dirname, `../public/uploads/${relativePath}`, imageName);
    // console.log(imagePath);
    if (fs.existsSync(imagePath)) {
      // console.log(imagePath);
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Error deleting image file:", err);
          return reject(new Error("Error deleting image file"));
        }
        resolve();
      });
    }
    resolve();
  });
};


module.exports = { deleteImageFile };