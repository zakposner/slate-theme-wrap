# Slate Theme Wrap

## Installation

1. Copy the contents of your theme's `config.yml` into `build/`
2. Copy the `src/` folder from your slate-compatible theme into the `core/` folder
3. Add your theme endpoint names to `build/package.json`
4. Start it up with the command `gulp watch [[theme-name]]`

## Purpose

Slate Theme Wrap allows you to quickly and easily cutomize your in-house Shopify theme to the needs of a new client. Simply add the `src` of your original theme into the core folder to get started. Any files and folders you add to the `instance/` folder will be parsed as follows:

If the file path exists in core - the instance file overrwrites the core file in the final build.
If the file path does not exist in core - the new file is added to the final build.

This system allows you to maintain your core theme as a submodule, while seperately tracking and maintaining site-specific theme customizations.