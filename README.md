# SEO Plugin for Obsidian 

A comprehensive SEO analysis plugin for Obsidian that helps you optimize your notes for better discoverability and search engine ranking.

![obsidian-seo-preview](https://github.com/user-attachments/assets/f015bae8-1c71-49f0-b9b8-0d7443249460)

## Made for Vault CMS

Part of the [Vault CMS](https://github.com/davidvkimball/vault-cms) project.

## Features

### **SEO Auditing**
- **Current Note Check** - Analyze the currently open note
- **Vault-wide Scan** - Check all notes in specified directories

### **Comprehensive SEO Checks**

#### **Content Quality**
- **Content Length** - Minimum word count threshold
- **Reading Level** - Analyzes readability and complexity
- **Keyword Density** - Optimal keyword usage
- **Duplicate Content** - Detects similar content across notes
- **Duplicate Titles** - Identifies duplicate titles across vault
- **Duplicate Descriptions** - Finds duplicate meta descriptions

#### **Technical SEO**
- **Title Optimization** - Proper title length and structure
- **Meta Description** - Properties description validation
- **Keyword in Title** - Ensures keywords appear in titles
- **Keyword in Description** - Validates keyword presence in descriptions
- **Keyword in Slug** - Checks keyword inclusion in filenames
- **Heading Structure** - Proper H1-H6 hierarchy
- **Media Alt Text** - Missing alt text detection for images, videos, embeds, etc.
- **Image Naming** - SEO-friendly image filename patterns

#### **Link Management**
- **Broken Links** - Detects non-existent internal links
- **Potentially Broken Links** - Identifies links that may be broken
- **External Links** - Validates external link accessibility
- **Naked Links** - Identifies unformatted URLs
- **Broken Embeds** - Detects potentially broken embedded content

### **User Experience**
- **Flexible Sorting** - Sort by issues, warnings, or filename
- **One-click Navigation** - Jump directly to problematic files
- **Caching** - Fast subsequent scans with intelligent cache management
- **Configurable Settings** - Customize all checks and thresholds

## Commands

| Command | Description |
|---------|-------------|
| **Open current note audit** | Open the current note audit panel |
| **Open vault audit** | Open the vault-wide audit panel |
| **Run current note audit** | Open panel and run audit on current note |
| **Run vault audit** | Open panel and run audit on all notes |

## SEO Score System

The plugin uses a weighted scoring system that prioritizes critical SEO factors:

- **Critical Issues** (10x weight): Broken links, missing titles
- **Important Issues** (5x weight): Missing alt text, meta descriptions  
- **Moderate Issues** (3x weight): Content length, readability
- **Minor Issues** (1x weight): Warnings and notices

**Score Range**: 40-100 (40 = needs work, 100 = excellent)

## Usage

### **Quick Current Note Check**
1. Open any markdown file
2. Use command "Run current note audit"
4. Review issues, warnings, and notices

### **Vault-wide Analysis**
1. Configure scan directories in settings
2. Use command "Run vault audit"
3. Review comprehensive analysis with sorting options
4. Click any file to open and fix issues

### **Performance Optimization**
- First scan builds cache (slower)
- Subsequent scans use cache (much faster)
- Cache automatically expires after 24 hours

## Installation

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.
2. In the BRAT plugin settings, select `Add beta plugin`.
3. Paste the following: `https://github.com/davidvkimball/obsidian-seo` and select `Add plugin`.

### Manual

1. Download the latest release from the [Releases page](https://github.com/davidvkimball/obsidian-seo/releases) and navigate to your Obsidian vault’s `.obsidian/plugins/` directory.
2. Ensure `manifest.json`, `main.js`, and `styles.css` are in the `seo` folder.
3. In Obsidian, go to **Settings > Community Plugins**, enable "Community Plugins" if not already enabled, and then enable "SEO."

## Privacy & Security

**Note**: This plugin includes an optional external link checking feature that requires an internet connection. This feature is **disabled by default** and can be enabled in the plugin settings if desired. All other SEO checks work entirely offline.

## Contributing

Submit issues or pull requests on the [GitHub repository](https://github.com/davidvkimball/obsidian-seo). Contributions to enhance features, improve documentation, or fix bugs are welcome!
