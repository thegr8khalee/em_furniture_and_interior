import React, { useEffect } from 'react';
import { useProjectsStore } from '../store/useProjectsStore';
import { Loader2 } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import { motion } from 'framer-motion';
import { luxuryEase, elegantEase } from '../lib/animations';
import { PageWrapper, SectionReveal } from '../components/animations';
import SEO from '../components/SEO';
import { breadcrumbJsonLd } from '../lib/seo';

const Projects = () => {
  const {
    fetchProjects,
    loading: LoadingProjects,
    projects,
  } = useProjectsStore();

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects(1, 20);
    }
  }, [fetchProjects, projects.length]);

  if (LoadingProjects) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading data...</p>
      </div>
    );
  }
  return (
    <PageWrapper>
    <SEO
      title="Our Projects & Portfolio"
      description="Explore completed interior design and furniture projects by EM Furniture & Interior — living rooms, bedrooms, dining rooms, and full-home transformations across Nigeria."
      canonical="/projects"
      jsonLd={breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Projects', path: '/projects' },
      ])}
    />
    <div className="min-h-screen bg-base-200 pt-16">
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <motion.img
          src={
            'https://res.cloudinary.com/dnwppcwec/image/upload/v1753787004/Hero1_ye6sa7.png'
          }
          alt=""
          className="object-cover h-full w-full"
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: luxuryEase }}
        />
        <div className="absolute inset-0 bg-primary/80 flex flex-col items-center justify-center">
          <motion.h1 className="font-heading text-3xl sm:text-4xl font-medium text-white text-center" initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, delay: 0.5, ease: elegantEase }}>
            Projects
          </motion.h1>
        </div>
      </div>
      <SectionReveal>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.length > 0 ? ( // Correct conditional check: use ? instead of (
          <>
            {' '}
            {/* Use a React Fragment to wrap multiple elements */}
            {/* Map over the 'projects' array. Ensure you use a unique 'key' prop. */}
            {projects.map((project) => (
              <ProjectCard
                key={project._id} // Assuming projects have a unique _id
                project={project}
              />
            ))}
          </>
        ) : null}
      </section>
      </SectionReveal>
    </div>
    </PageWrapper>
  );
};

export default Projects;
