import Designer from '../models/designer.model.js';
import cloudinary from '../lib/cloudinary.js';

const uploadAvatar = async (avatarData) => {
  if (!avatarData || typeof avatarData !== 'string') {
    return null;
  }
  if (!avatarData.startsWith('data:image')) {
    return null;
  }

  const uploadResponse = await cloudinary.uploader.upload(avatarData, {
    folder: 'designers',
  });

  return {
    url: uploadResponse.secure_url,
    public_id: uploadResponse.public_id,
  };
};

export const getActiveDesigners = async (req, res) => {
  try {
    const designers = await Designer.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({ designers });
  } catch (error) {
    console.error('Error fetching designers:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getAllDesigners = async (req, res) => {
  try {
    const designers = await Designer.find({}).sort({ createdAt: -1 });
    res.status(200).json({ designers });
  } catch (error) {
    console.error('Error fetching designers:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const createDesigner = async (req, res) => {
  try {
    const { name, title, bio, avatar, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    const avatarUpload = await uploadAvatar(avatar);

    const designer = await Designer.create({
      name,
      title: title || '',
      bio: bio || '',
      avatar: avatarUpload || undefined,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ designer });
  } catch (error) {
    console.error('Error creating designer:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const { name, title, bio, avatar, isActive } = req.body;

    const designer = await Designer.findById(designerId);
    if (!designer) {
      return res.status(404).json({ message: 'Designer not found.' });
    }

    if (name) designer.name = name;
    if (title !== undefined) designer.title = title;
    if (bio !== undefined) designer.bio = bio;
    if (typeof isActive === 'boolean') designer.isActive = isActive;

    if (avatar) {
      const avatarUpload = await uploadAvatar(avatar);
      if (avatarUpload) {
        designer.avatar = avatarUpload;
      }
    }

    await designer.save();

    res.status(200).json({ designer });
  } catch (error) {
    console.error('Error updating designer:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const designer = await Designer.findByIdAndDelete(designerId);

    if (!designer) {
      return res.status(404).json({ message: 'Designer not found.' });
    }

    res.status(200).json({ message: 'Designer deleted.' });
  } catch (error) {
    console.error('Error deleting designer:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
