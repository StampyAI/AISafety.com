'use client'

import type { Project } from '@/lib/data/projects'

interface ProjectCardProps {
  project: Project
}

// The /projects card: a static, non-clickable card (projects have no external
// URL) with labelled Contact and Status rows. The admin Queue's "how it will
// look on the site" preview renders this same component.
export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="card card-static">
      <h3 className="padding-bottom-24px">{project.name}</h3>
      <p className="paragraph-small padding-bottom-24px">
        {project.description}
      </p>
      <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
        Contact
      </p>
      <p className="paragraph-small">{project.contact}</p>
      {project.email && <p className="paragraph-small">{project.email}</p>}
      <p className="paragraph-xs-bold padding-top-16px padding-bottom-4px color-teal-400">
        Status
      </p>
      <p className="paragraph-small">{project.status}</p>
    </div>
  )
}
