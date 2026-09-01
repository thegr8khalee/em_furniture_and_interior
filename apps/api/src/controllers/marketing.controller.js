import PromoBanner from '../models/promoBanner.model.js';
import FlashSale from '../models/flashSale.model.js';

const isWithinWindow = (doc, now) => {
  if (!doc.isActive) return false;
  if (doc.startDate && doc.startDate > now) return false;
  if (doc.endDate && doc.endDate < now) return false;
  return true;
};

// Promo Banners
export const getAdminBanners = async (req, res) => {
  try {
    const banners = await PromoBanner.find().sort({ priority: -1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    console.error('Error fetching promo banners:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await PromoBanner.find({ isActive: true }).sort({ priority: -1, createdAt: -1 });
    const activeBanners = banners.filter((banner) => isWithinWindow(banner, now));
    res.json({ success: true, banners: activeBanners });
  } catch (error) {
    console.error('Error fetching active promo banners:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      imageUrl,
      linkUrl,
      position,
      priority,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ message: 'Title and image URL are required.' });
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }

    const banner = await PromoBanner.create({
      title,
      subtitle,
      imageUrl,
      linkUrl,
      position,
      priority: typeof priority === 'number' ? priority : 0,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.status(201).json({ success: true, banner });
  } catch (error) {
    console.error('Error creating promo banner:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const update = { ...req.body };

    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.endDate) update.endDate = new Date(update.endDate);

    if (update.startDate && update.endDate && update.endDate < update.startDate) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }

    const banner = await PromoBanner.findByIdAndUpdate(bannerId, update, {
      new: true,
    });

    if (!banner) {
      return res.status(404).json({ message: 'Promo banner not found.' });
    }

    res.json({ success: true, banner });
  } catch (error) {
    console.error('Error updating promo banner:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const banner = await PromoBanner.findByIdAndDelete(bannerId);

    if (!banner) {
      return res.status(404).json({ message: 'Promo banner not found.' });
    }

    res.json({ success: true, message: 'Promo banner deleted.' });
  } catch (error) {
    console.error('Error deleting promo banner:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Flash Sales
export const getAdminFlashSales = async (req, res) => {
  try {
    const flashSales = await FlashSale.find().sort({ startDate: -1 });
    res.json({ success: true, flashSales });
  } catch (error) {
    console.error('Error fetching flash sales:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getActiveFlashSales = async (req, res) => {
  try {
    const now = new Date();
    const flashSales = await FlashSale.find({ isActive: true }).sort({ startDate: -1 });
    const activeSales = flashSales.filter((sale) => isWithinWindow(sale, now));
    res.json({ success: true, flashSales: activeSales });
  } catch (error) {
    console.error('Error fetching active flash sales:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createFlashSale = async (req, res) => {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      productIds,
      collectionIds,
      bannerImageUrl,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (!name || !discountType || discountValue === undefined || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Name, discount type/value, start date, and end date are required.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }

    const flashSale = await FlashSale.create({
      name,
      description,
      discountType,
      discountValue,
      productIds: Array.isArray(productIds) ? productIds : [],
      collectionIds: Array.isArray(collectionIds) ? collectionIds : [],
      bannerImageUrl,
      isActive: isActive !== undefined ? isActive : true,
      startDate: start,
      endDate: end,
    });

    res.status(201).json({ success: true, flashSale });
  } catch (error) {
    console.error('Error creating flash sale:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateFlashSale = async (req, res) => {
  try {
    const { flashSaleId } = req.params;
    const update = { ...req.body };

    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.endDate) update.endDate = new Date(update.endDate);
    if (update.startDate && update.endDate && update.endDate < update.startDate) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }

    const flashSale = await FlashSale.findByIdAndUpdate(flashSaleId, update, {
      new: true,
    });

    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found.' });
    }

    res.json({ success: true, flashSale });
  } catch (error) {
    console.error('Error updating flash sale:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteFlashSale = async (req, res) => {
  try {
    const { flashSaleId } = req.params;
    const flashSale = await FlashSale.findByIdAndDelete(flashSaleId);

    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found.' });
    }

    res.json({ success: true, message: 'Flash sale deleted.' });
  } catch (error) {
    console.error('Error deleting flash sale:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
