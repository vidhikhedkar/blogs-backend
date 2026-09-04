const Blog = require('../model/blogSchema');

const generateSlug = (text) => {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

const parseTags = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    return [];
};

// Helper to safely parse author data if sent as a JSON string or object from frontend
const parseAuthor = (author) => {
    if (!author) return undefined;
    if (typeof author === 'string') {
        try {
            return JSON.parse(author);
        } catch {
            return { name: author };
        }
    }
    return author;
};

const getAllBlogs = async (req, res) => {
    try {
        const { search, category, tag, status, author } = req.query;

        let query = { isDeleted: false };

        if (status) {
            query.status = status;
        } else {
            query.status = 'published';
        }

        if (category && category !== 'All') {
            query.category = category;
        }

        if (tag) {
            query.tags = tag;
        }

        if (author) {
            query['author.name'] = { $regex: author, $options: 'i' };
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { seoTitle: { $regex: search, $options: 'i' } },
                { metaDescription: { $regex: search, $options: 'i' } },
                { 'author.name': { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        const blogs = await Blog.find(query).sort({ createdAt: -1 });
        res.status(200).json(blogs);
    } catch (error) {
        console.error("getAllBlogs error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;
        const filter = id.match(/^[0-9a-fA-F]{24}$/)
            ? { _id: id, isDeleted: false }
            : { slug: id, isDeleted: false };

        const blog = await Blog.findOneAndUpdate(
            filter,
            { $inc: { reads: 1 } },
            { new: true }
        );

        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        res.status(200).json(blog);
    } catch (error) {
        console.error("getBlogById error:", error);
        res.status(500).json({ error: error.message || 'Invalid ID/Slug format or Internal Server Error' });
    }
};

const createBlog = async (req, res) => {
    try {
        const { title, excerpt, content, category, tags, date, readTime, reads, seoTitle, metaDescription, slug, status, author } = req.body;
        const image = req.file ? req.file.path : '';

        if (!title || !content || !category || !image) {
            return res.status(400).json({ error: 'Missing required fields or image upload failed' });
        }

        const finalSlug = slug ? generateSlug(slug) : generateSlug(title);

        const existingSlug = await Blog.findOne({ slug: finalSlug });
        if (existingSlug) {
            return res.status(400).json({ error: 'Slug must be unique. A blog with this slug already exists.' });
        }

        const parsedAuthor = parseAuthor(author);

        const newBlog = new Blog({
            title,
            excerpt,
            content,
            category,
            tags: parseTags(tags),
            image,
            date,
            readTime,
            reads: reads ? Number(reads) : 0,
            seoTitle: seoTitle || title,
            metaDescription: metaDescription || excerpt,
            slug: finalSlug,
            status: status || 'draft',
            author: parsedAuthor || { name: 'Admin' }
        });

        await newBlog.save();
        res.status(201).json({ message: 'Blog created successfully', blog: newBlog });
    } catch (error) {
        console.error("createBlog error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

const updateBlog = async (req, res) => {
    try {
        const blogId = req.params.id;

        const updateData = {
            title: req.body.title,
            excerpt: req.body.excerpt,
            content: req.body.content,
            category: req.body.category,
            tags: req.body.tags ? parseTags(req.body.tags) : undefined,
            date: req.body.date,
            readTime: req.body.readTime,
            reads: req.body.reads,
            seoTitle: req.body.seoTitle,
            metaDescription: req.body.metaDescription,
            status: req.body.status,
            author: parseAuthor(req.body.author)
        };

        if (req.body.slug) {
            updateData.slug = generateSlug(req.body.slug);
        } else if (req.body.title) {
            updateData.slug = generateSlug(req.body.title);
        }

        if (updateData.slug) {
            const existingSlug = await Blog.findOne({ slug: updateData.slug, _id: { $ne: blogId } });
            if (existingSlug) {
                return res.status(400).json({ error: 'Slug must be unique. Another blog already uses this slug.' });
            }
        }

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        if (req.file) {
            updateData.image = req.file.path;
        } else if (req.body.image && typeof req.body.image === 'string') {
            updateData.image = req.body.image;
        } else {
            delete updateData.image;
        }

        const updatedBlog = await Blog.findOneAndUpdate(
            { _id: blogId, isDeleted: false },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedBlog) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        res.status(200).json(updatedBlog);
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ error: error.message });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        res.status(200).json({ message: 'Blog soft deleted successfully', blog });
    } catch (error) {
        console.error("deleteBlog error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

const restoreBlog = async (req, res) => {
    try {
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            { isDeleted: false, deletedAt: null },
            { new: true }
        );

        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        res.status(200).json({ message: 'Blog restored successfully', blog });
    } catch (error) {
        console.error("restoreBlog error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

const uploadInlineImage = async (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ error: 'No image file provided or upload failed' });
        }
        res.status(200).json({ url: req.file.path });
    } catch (error) {
        console.error("uploadInlineImage error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};


// PERMANENT / HARD DELETE
const hardDeleteBlog = async (req, res) => {
    try {
        const deletedBlog = await Blog.findByIdAndDelete(req.params.id);

        if (!deletedBlog) {
            return res.status(404).json({ error: 'Blog post not found to permanently delete' });
        }

        res.status(200).json({
            message: 'Blog permanently deleted from database',
            id: deletedBlog._id
        });
    } catch (error) {
        console.error("hardDeleteBlog error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

module.exports = {
    getAllBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,       // Soft Delete (isDeleted: true)
    restoreBlog,      // Restore Soft Deleted
    hardDeleteBlog,   // Permanent Delete
    uploadInlineImage
};

