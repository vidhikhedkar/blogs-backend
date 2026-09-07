const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { type: String, },
    excerpt: { type: String },
    content: { type: String, },
    category: { type: String, },
    tags: { type: [String], default: [] },
    image: { type: String, },
    date: { type: String },
    readTime: { type: String },
    reads: { type: Number, default: 0 },
    seoTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    slug: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    author: {
        name: { type: String, default: 'Admin' },
        // avatar: { type: String, default: '' },
        role: { type: String, default: 'Author' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Blog', blogSchema);