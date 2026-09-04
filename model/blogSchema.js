const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    excerpt: { type: String },
    content: { type: String, required: true },
    category: { type: String, required: true },
    tags: { type: [String], default: [] },
    image: { type: String, required: true },
    date: { type: String },
    readTime: { type: String },
    reads: { type: Number, default: 0 },
    seoTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    author: {
        name: { type: String, default: 'Admin' },
        avatar: { type: String, default: '' },
        role: { type: String, default: 'Author' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Blog', blogSchema);