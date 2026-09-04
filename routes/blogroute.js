const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const {
    getAllBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,
    restoreBlog,
    hardDeleteBlog,
    uploadInlineImage
} = require('../controller/blogcontroller');

// Collection Routes
router.get('/blogs', getAllBlogs);
router.post('/blogs', upload.single('image'), createBlog);

// Utility Action Routes
router.post('/blogs/upload-inline-image', upload.single('image'), uploadInlineImage);
router.patch('/blogs/:id/restore', restoreBlog);
router.delete('/blogs/:id/permanent', hardDeleteBlog);

// Individual Document Routes
router.get('/blogs/:id', getBlogById);
router.put('/blogs/:id', upload.single('image'), updateBlog);
router.delete('/blogs/:id', deleteBlog);

module.exports = router;