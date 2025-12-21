import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: "backend/uploads/raw",
    filename: (req, file, cb) => {  
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }   
});
export const upload = multer({ storage });