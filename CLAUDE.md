## Always follow these rules:

- This project uses yarn as a package manager and as script running tool. So, for debugging - use yarn dev and yarn build, if you need to check for errors.
- This project uses Tailwind 4 - always use up to date Tailwind CSS practices. For example - config file isn't separated from the theme file anymore, Tailwind uses layer directives etc.

-Always use best Tailwind, TypeScript, Supabase and best web dev practices in general. Additionally, consult documentation whenever in doubt.

- Do not provide fallbacks when writing code - raise errors. We want to catch errors in development sooner rather than later.

-After making changes to the project, test if everything works.

Dev server is usually always running at localhost:4321 for Astro. But if needed, you can also start another dev server on localhost in shell and see if any breaking error is logged there. These URLs are not publically accessible - access the website content / CMS content using bash and curl. Then - document changes in the local-claude-files by making a new file in that directory. Create new subfolders within if needed, to improve readability. That directory is present but it's being ignored by git - you are to make an exception and not ignore it. When in doubt, see those files for reference and more context.

-Only after making sure the results are good by following the aforementioned steps, provide user with the output.

## MCP Servers Setup Guide

See mcp-servers-setup.md

## Task 2:

1. Let's move design to shadcn/tailwind. Use hex colors for tailwind variables instead of oklch.
2. Let's add auth and persistent database storage in supabase:

database password: c#jHUQ6E-gX97wn  
 project name: mantrabesupabase  
 postgresql://postgres:[YOUR-PASSWORD]@db.qtakphvcpkxzlgauxyxd.supabase.co:5432/postgres

Auth should be possible by sign up with google / github / email

Read supabase docs and do it in a scalable and clean way.

Think deeply about these and complete them. You're awesome for doing this, thanks!
