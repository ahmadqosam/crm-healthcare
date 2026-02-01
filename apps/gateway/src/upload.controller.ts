import { Controller, Post, UseInterceptors, UploadedFile, Get, Param, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('upload')
export class UploadController {
    @Post()
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf)$/)) {
                cb(null, true);
            } else {
                cb(new Error('Unsupported file type'), false);
            }
        }
    }))
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        // In Docker, localhost refers to the container, but from browser it's localhost:3000
        // We return a relative path or full URL based on assumption
        return {
            url: `http://localhost:3000/uploads/${file.filename}`
        };
    }
}
