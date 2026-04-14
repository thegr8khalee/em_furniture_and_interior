import React, { useEffect, useState } from 'react';
import { Palette, Upload } from 'lucide-react';
import { axiosInstance } from '../lib/axios.js';
import { PageWrapper, FadeIn, SectionReveal } from '../components/animations';
import { Button, Card, Input, PageHeader, Select, Textarea } from '../components/ui';

const styleOptions = ['Modern', 'Contemporary', 'Antique/Royal', 'Bespoke', 'Minimalist', 'Glam'];

const Consultation = () => {
  const [designers, setDesigners] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    budgetMin: '',
    budgetMax: '',
    stylePreferences: [],
    preferredDesigner: '',
    preferredMeetingType: 'calendly',
    notes: '',
  });
  const [roomPhotos, setRoomPhotos] = useState([]);
  const [floorPlan, setFloorPlan] = useState(null);

  useEffect(() => {
    const fetchDesigners = async () => {
      try {
        const res = await axiosInstance.get('/designers');
        setDesigners(res.data.designers || []);
      } catch (error) {
        console.error('Failed to load designers:', error);
      }
    };

    fetchDesigners();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStyleToggle = (style) => {
    setFormData((prev) => {
      const exists = prev.stylePreferences.includes(style);
      return {
        ...prev,
        stylePreferences: exists
          ? prev.stylePreferences.filter((item) => item !== style)
          : [...prev.stylePreferences, style],
      };
    });
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const handleRoomPhotosChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const uploads = await Promise.all(files.map((file) => toBase64(file)));
    setRoomPhotos(uploads);
  };

  const handleFloorPlanChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const upload = await toBase64(file);
    setFloorPlan(upload);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.fullName || !formData.email || !formData.phone) {
      setFormError('Please fill in your name, email, and phone.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post('/consultations', {
        ...formData,
        roomPhotos,
        floorPlan,
      });
      setFormSuccess('Consultation request submitted successfully.');
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        budgetMin: '',
        budgetMax: '',
        stylePreferences: [],
        preferredDesigner: '',
        preferredMeetingType: 'calendly',
        notes: '',
      });
      setRoomPhotos([]);
      setFloorPlan(null);
    } catch (error) {
      setFormError(
        error.response?.data?.message || 'Unable to submit consultation request.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <div className="min-h-screen mt-16 bg-base-100">
        <PageHeader
          title="Book a Consultation"
          subtitle="Schedule a design session with our team to bring your space to life."
          image="https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png"
          alt="Design consultation"
        />

        <div className="content-shell section-shell">
          <FadeIn>
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Personalised interior guidance
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold text-primary sm:text-4xl">
                Tell us about your project
              </h2>
              <p className="mt-3 text-sm text-neutral/70 sm:text-base">
                Share your preferences, budget, and inspiration so we can recommend the right direction for your space.
              </p>
            </div>
          </FadeIn>

          <SectionReveal>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Card className="surface-elevated" padding="p-6 sm:p-8">
                <div className="mb-6">
                  <h3 className="font-heading text-2xl font-semibold text-neutral">
                    Consultation Details
                  </h3>
                  <p className="mt-2 text-sm text-neutral/60">
                    Fill in the essentials and we’ll follow up with a tailored next step.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="text"
                    name="fullName"
                    label="Full Name"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    type="email"
                    name="email"
                    label="Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    type="tel"
                    name="phone"
                    label="Phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      type="number"
                      name="budgetMin"
                      label="Budget Min (NGN)"
                      value={formData.budgetMin}
                      onChange={handleChange}
                      min="0"
                    />
                    <Input
                      type="number"
                      name="budgetMax"
                      label="Budget Max (NGN)"
                      value={formData.budgetMax}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65">
                      Style Preferences
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {styleOptions.map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => handleStyleToggle(style)}
                          className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                            formData.stylePreferences.includes(style)
                              ? 'border-primary bg-primary text-white'
                              : 'border-base-300 bg-white text-neutral hover:border-secondary hover:text-secondary'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Select
                    name="preferredDesigner"
                    label="Preferred Designer"
                    value={formData.preferredDesigner}
                    onChange={handleChange}
                  >
                    <option value="">No preference</option>
                    {designers.map((designer) => (
                      <option key={designer._id} value={designer._id}>
                        {designer.name}
                      </option>
                    ))}
                  </Select>

                  <Select
                    name="preferredMeetingType"
                    label="Meeting Type"
                    value={formData.preferredMeetingType}
                    onChange={handleChange}
                  >
                    <option value="office">In Person</option>
                    <option value="zoom">Zoom</option>
                    <option value="meet">Google Meet</option>
                    <option value="phone">Phone Call</option>
                  </Select>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      type="file"
                      name="roomPhotos"
                      label="Room Photos"
                      onChange={handleRoomPhotosChange}
                      className="file:mr-4 file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.12em] file:text-white hover:file:bg-secondary hover:file:text-primary"
                      multiple
                      accept="image/*"
                    />
                    <Input
                      type="file"
                      name="floorPlan"
                      label="Floor Plan"
                      onChange={handleFloorPlanChange}
                      className="file:mr-4 file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.12em] file:text-white hover:file:bg-secondary hover:file:text-primary"
                      accept="image/*"
                    />
                  </div>

                  <Textarea
                    name="notes"
                    label="Notes"
                    rows="4"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Tell us about your space, style, or any special requests."
                  />

                  {formError ? (
                    <div className="border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
                      {formError}
                    </div>
                  ) : null}
                  {formSuccess ? (
                    <div className="border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                      {formSuccess}
                    </div>
                  ) : null}

                  <Button type="submit" isLoading={isSubmitting} fullWidth>
                    Submit Request
                  </Button>
                </form>
              </Card>

              <Card className="surface-elevated overflow-hidden" padding="p-0">
                <div className="border-b border-base-300 px-6 py-5 sm:px-8">
                  <div className="flex items-center gap-3">
                    <div className="border border-secondary/30 bg-secondary/10 p-2 text-secondary">
                      <Palette size={18} />
                    </div>
                    <div>
                      <h3 className="font-heading text-2xl font-semibold text-neutral">
                        Schedule Instantly
                      </h3>
                      <p className="text-sm text-neutral/60">
                        Pick a time that works for you through our live booking calendar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-base-300 bg-base-100 px-6 py-4 text-sm text-neutral/70 sm:px-8">
                  <div className="flex items-center gap-2">
                    <Upload size={16} className="text-secondary" />
                    Upload inspiration photos or a floor plan to help our team prepare.
                  </div>
                </div>

                <div className="overflow-hidden border-t border-base-300">
                  <div
                    className="calendly-inline-widget"
                    data-url="https://calendly.com/emfurnitureandinterior/30min"
                    style={{ minWidth: '320px', height: '700px' }}
                  ></div>
                  <script
                    type="text/javascript"
                    src="https://assets.calendly.com/assets/external/widget.js"
                    async
                  ></script>
                </div>
              </Card>
            </div>
          </SectionReveal>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Consultation;
