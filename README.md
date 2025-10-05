# SEO Plugin for Obsidian 

**Ensure your public-facing notes are optimized for search engines and AI.**

A comprehensive SEO analysis tool for Obsidian that helps you optimize your notes for better discoverability and search engine ranking.

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

#### **Technical SEO**
- **Title Optimization** - Proper title length and structure
- **Meta Description** - Frontmatter description validation
- **Heading Structure** - Proper H1-H6 hierarchy
- **Image Alt Text** - Missing alt text detection
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
| **Open current note audit** | Audit the currently open note |
| **Open vault audit** | Audit all notes in configured directories |

## SEO Score System

The plugin uses a weighted scoring system that prioritizes critical SEO factors:

- **Critical Issues** (10x weight): Broken links, missing titles
- **Important Issues** (5x weight): Missing alt text, meta descriptions  
- **Moderate Issues** (3x weight): Content length, readability
- **Minor Issues** (1x weight): Warnings and suggestions

**Score Range**: 40-100 (40 = needs work, 100 = excellent)

## Usage

### **Quick Current Note Check**
1. Open any markdown file
2. Use command "Open current note audit"
3. Click "Check current note" to run analysis
4. Review issues and warnings

### **Vault-wide Analysis**
1. Configure scan directories in settings
2. Use command "Open vault audit"
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

1. Clone or download this plugin into your Obsidian vault’s `.obsidian/plugins/` directory.
2. Ensure `manifest.json`, `main.js`, and `styles.css` are in the `seo` folder.
3. In Obsidian, go to **Settings > Community Plugins**, enable "Community Plugins" if not already enabled, and then enable "SEO."

## Contributing

Submit issues or pull requests on the [GitHub repository](https://github.com/davidvkimball/obsidian-seo). Contributions to enhance features, improve documentation, or fix bugs are welcome!
