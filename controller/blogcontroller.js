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
            query.status = status.toLowerCase();
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
        const {
            title,
            headline,
            excerpt,
            content,
            category,
            tags,
            date,
            publicationDate,
            readTime,
            reads,
            seoTitle,
            metaTitle,
            metaDescription,
            slug,
            status,
            author
        } = req.body;

        const blogStatus = status || 'draft';

        // Cloudinary uploaded image
        const image = req.file ? req.file.path : '';

        /*
        ============================================================
        DRAFT VALIDATION
        ============================================================
        Drafts are allowed to have incomplete information.

        Example:
        - Only headline → allowed
        - Only content → allowed
        - Only category → allowed
        - Only image → allowed
        - Only slug → allowed

        We only require that the user entered at least one detail.
        ============================================================
        */

        if (blogStatus === 'draft') {
            const hasAnyData =
                title?.trim() ||
                headline?.trim() ||
                excerpt?.trim() ||
                content?.trim() ||
                category?.trim() ||
                slug?.trim() ||
                tags ||
                image ||
                publicationDate ||
                date ||
                metaTitle?.trim() ||
                seoTitle?.trim() ||
                metaDescription?.trim() ||
                author;

            if (!hasAnyData) {
                return res.status(400).json({
                    error: 'Please provide at least one detail to save the draft'
                });
            }
        }

        /*
        ============================================================
        PUBLISHED VALIDATION
        ============================================================
        Published blogs must contain the important fields.
        ============================================================
        */

        if (blogStatus === 'published') {
            if (!title?.trim()) {
                return res.status(400).json({
                    error: 'Blog title is required to publish'
                });
            }

            if (!content?.trim()) {
                return res.status(400).json({
                    error: 'Blog content is required to publish'
                });
            }

            if (!category?.trim()) {
                return res.status(400).json({
                    error: 'Blog category is required to publish'
                });
            }

            if (!image) {
                return res.status(400).json({
                    error: 'Cover image is required to publish'
                });
            }

            if (!slug?.trim()) {
                return res.status(400).json({
                    error: 'Blog slug is required to publish'
                });
            }
        }

        /*
        ============================================================
        SLUG
        ============================================================
        */

        let finalSlug = '';

        if (slug?.trim()) {
            finalSlug = generateSlug(slug);
        } else if (title?.trim()) {
            finalSlug = generateSlug(title);
        }

        /*
        ============================================================
        CHECK SLUG ONLY WHEN A SLUG EXISTS
        ============================================================
        */

        if (finalSlug) {
            const existingSlug = await Blog.findOne({
                slug: finalSlug
            });

            if (existingSlug) {
                return res.status(400).json({
                    error:
                        'Slug must be unique. A blog with this slug already exists.'
                });
            }
        }

        /*
        ============================================================
        PARSE AUTHOR
        ============================================================
        */

        const parsedAuthor = parseAuthor(author);

        /*
        ============================================================
        CREATE BLOG
        ============================================================
        */

        const newBlog = new Blog({
            title: title || headline || '',
            excerpt: excerpt || '',
            content: content || '',
            category: category || '',
            tags: parseTags(tags),
            image: image || '',
            date: date || publicationDate || '',
            readTime: readTime || '1',
            reads: reads ? Number(reads) : 0,

            // Support both frontend names
            seoTitle: seoTitle || metaTitle || '',
            metaDescription: metaDescription || excerpt || '',

            // Important:
            // Do not store empty string because slug is unique.
            ...(finalSlug ? { slug: finalSlug } : {}),

            status: blogStatus,

            author: parsedAuthor || {
                name: 'Admin',
                role: 'Author'
            }
        });

        await newBlog.save();

        res.status(201).json({
            message:
                blogStatus === 'draft'
                    ? 'Draft saved successfully'
                    : 'Blog published successfully',
            blog: newBlog
        });

    } catch (error) {
        console.error('createBlog error:', error);

        /*
        ============================================================
        MONGOOSE DUPLICATE KEY ERROR
        ============================================================
        */

        if (error.code === 11000) {
            return res.status(400).json({
                error:
                    'Slug must be unique. A blog with this slug already exists.'
            });
        }

        res.status(500).json({
            error:
                error.message ||
                'Internal Server Error'
        });
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



// ============================================================
// GET TRASH BLOGS
// GET /api/blogs/trash
// ============================================================
const getTrashBlogs = async (req, res) => {
    try {
        const { search, category, tag, status, author } = req.query;

        let query = {
            isDeleted: true
        };

        if (status) {
            query.status = status.toLowerCase();
        }

        if (category && category !== 'All') {
            query.category = category;
        }

        if (tag) {
            query.tags = tag;
        }

        if (author) {
            query['author.name'] = {
                $regex: author,
                $options: 'i'
            };
        }

        if (search) {
            query.$or = [
                {
                    title: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    excerpt: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    seoTitle: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    metaDescription: {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    'author.name': {
                        $regex: search,
                        $options: 'i'
                    }
                },
                {
                    tags: {
                        $regex: search,
                        $options: 'i'
                    }
                }
            ];
        }

        const blogs = await Blog.find(query)
            .sort({ deletedAt: -1, updatedAt: -1 });

        res.status(200).json(blogs);

    } catch (error) {
        console.error('getTrashBlogs error:', error);

        res.status(500).json({
            error:
                error.message ||
                'Internal Server Error'
        });
    }
};

module.exports = {
    getAllBlogs,
    getTrashBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    deleteBlog,       // Soft Delete (isDeleted: true)
    restoreBlog,      // Restore Soft Deleted
    hardDeleteBlog,   // Permanent Delete
    uploadInlineImage
};

