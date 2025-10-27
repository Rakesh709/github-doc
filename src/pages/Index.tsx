import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Github, Download, Copy, CheckCircle2, FolderTree, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

import {  Linkedin, Youtube, Globe } from "lucide-react";

interface RepoData {
  name: string;
  description: string;
  clone_url: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  html_url: string;
  owner: {
    login: string;
    html_url: string;
  };
  license: {
    name: string;
  } | null;
  topics?: string[];
  default_branch: string;
}

interface FileContent {
  name: string;
  type: string;
  path: string;
  sha?: string;
  download_url?: string;
}

interface TreeNode {
  name: string;
  type: string;
  children?: TreeNode[];
}

export default function Index() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [documentation, setDocumentation] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [includeFolderTree, setIncludeFolderTree] = useState(true);
  const [includeAISummary, setIncludeAISummary] = useState(true);

  const extractRepoInfo = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
    return null;
  };

  const fetchDirectoryContents = async (owner: string, repo: string, path = ''): Promise<FileContent[]> => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  };

  const buildFileTree = async (owner: string, repo: string, path = '', depth = 0, maxDepth = 3): Promise<TreeNode[]> => {
    if (depth >= maxDepth) return [];
    
    const contents = await fetchDirectoryContents(owner, repo, path);
    const tree: TreeNode[] = [];

    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'venv', '.venv'];
    
    for (const item of contents) {
      if (ignoreDirs.includes(item.name)) continue;
      
      if (item.type === 'dir') {
        const children = await buildFileTree(owner, repo, item.path, depth + 1, maxDepth);
        tree.push({
          name: item.name,
          type: 'dir',
          children: children.length > 0 ? children : undefined
        });
      } else {
        tree.push({
          name: item.name,
          type: 'file'
        });
      }
    }

    return tree.sort((a, b) => {
      if (a.type === 'dir' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const renderTree = (nodes: TreeNode[], prefix = '', isLast = true): string => {
    // const renderTree = (nodes: TreeNode[], prefix = '', isLast = true): string => {
    let result = '';
    
    nodes.forEach((node, index) => {
      const isLastNode = index === nodes.length - 1;
      const connector = isLastNode ? '└── ' : '├── ';
      const icon = node.type === 'dir' ? '📁 ' : '📄 ';
      
       const currentPrefix = isLast ? prefix : '│   ' + prefix;
      // result += prefix + connector + icon + node.name + '\n';
        result += currentPrefix + connector + icon + node.name + '\n';

      
      if (node.children && node.children.length > 0) {
        const newPrefix = prefix + (isLastNode ? '    ' : '│   ');
        result += renderTree(node.children, newPrefix, isLastNode);
      }
    });
    
    return result;
  };

  const generateAISummary = async (repoData: RepoData, contents: FileContent[], languages: Record<string, number>): Promise<string> => {
    // Analyze repository structure and content
    const hasTests = contents.some(f => f.name.toLowerCase().includes('test') || f.name === 'tests' || f.name === '__tests__');
    const hasCI = contents.some(f => f.name === '.github' || f.name === '.gitlab-ci.yml' || f.name === '.circleci');
    const hasDocker = contents.some(f => f.name === 'Dockerfile' || f.name === 'docker-compose.yml');
    const hasDocs = contents.some(f => f.name === 'docs' || f.name === 'documentation');
    
    const primaryLanguage = Object.keys(languages)[0] || 'Unknown';
    const languageCount = Object.keys(languages).length;
    
    // Determine project type based on files and structure
    let projectType = 'software project';
    if (contents.some(f => f.name === 'package.json')) {
      if (contents.some(f => f.name === 'next.config.js' || f.name === 'next.config.ts')) {
        projectType = 'Next.js web application';
      } else if (contents.some(f => f.name === 'vite.config.js' || f.name === 'vite.config.ts')) {
        projectType = 'Vite-powered web application';
      } else if (contents.some(f => f.name === 'tsconfig.json')) {
        projectType = 'TypeScript/JavaScript application';
      } else {
        projectType = 'Node.js application';
      }
    } else if (contents.some(f => f.name === 'requirements.txt' || f.name === 'setup.py')) {
      projectType = 'Python application';
    } else if (contents.some(f => f.name === 'pom.xml')) {
      projectType = 'Java Maven project';
    } else if (contents.some(f => f.name === 'build.gradle')) {
      projectType = 'Java Gradle project';
    } else if (contents.some(f => f.name === 'Cargo.toml')) {
      projectType = 'Rust project';
    } else if (contents.some(f => f.name === 'go.mod')) {
      projectType = 'Go application';
    }

    // Build quality indicators
    const qualityIndicators: string[] = [];
    if (hasTests) qualityIndicators.push('✅ Includes test suite');
    if (hasCI) qualityIndicators.push('✅ CI/CD pipeline configured');
    if (hasDocker) qualityIndicators.push('✅ Docker support');
    if (hasDocs) qualityIndicators.push('✅ Documentation available');
    if (repoData.license) qualityIndicators.push(`✅ Licensed under ${repoData.license.name}`);

    // Generate intelligent summary
    let summary = `### 🤖 AI-Generated Project Analysis\n\n`;
    summary += `**Project Type:** ${projectType}\n\n`;
    summary += `**Primary Language:** ${primaryLanguage}${languageCount > 1 ? ` (+ ${languageCount - 1} other${languageCount > 2 ? 's' : ''})` : ''}\n\n`;
    
    if (repoData.topics && repoData.topics.length > 0) {
      summary += `**Topics:** ${repoData.topics.map(t => `\`${t}\``).join(', ')}\n\n`;
    }

    summary += `**Project Maturity:**\n`;
    summary += `- ${repoData.stargazers_count} stars indicate ${repoData.stargazers_count > 100 ? 'strong' : repoData.stargazers_count > 10 ? 'moderate' : 'emerging'} community interest\n`;
    summary += `- ${repoData.forks_count} forks suggest ${repoData.forks_count > 50 ? 'active' : repoData.forks_count > 10 ? 'growing' : 'initial'} community contributions\n`;
    summary += `- ${repoData.open_issues_count} open issues ${repoData.open_issues_count > 50 ? '(actively maintained)' : repoData.open_issues_count > 0 ? '(under development)' : '(stable)'}\n\n`;

    if (qualityIndicators.length > 0) {
      summary += `**Quality Indicators:**\n`;
      qualityIndicators.forEach(indicator => {
        summary += `${indicator}\n`;
      });
      summary += '\n';
    }

    // Add smart recommendations
    summary += `**Recommended Use Cases:**\n`;
    if (projectType.includes('web application')) {
      summary += `- Building modern web applications with ${primaryLanguage}\n`;
      summary += `- Learning web development best practices\n`;
    } else if (projectType.includes('Python')) {
      summary += `- Data processing and analysis\n`;
      summary += `- Backend API development\n`;
    } else if (projectType.includes('Java')) {
      summary += `- Enterprise application development\n`;
      summary += `- Building scalable backend services\n`;
    }
    
    if (hasDocker) {
      summary += `- Containerized deployment scenarios\n`;
    }
    if (hasTests) {
      summary += `- Learning testing methodologies\n`;
    }

    return summary;
  };

  const generateDocumentation = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL');
      return;
    }

    const repoInfo = extractRepoInfo(repoUrl);
    if (!repoInfo) {
      setError('Invalid GitHub URL. Please use format: https://github.com/owner/repo');
      return;
    }

    setLoading(true);
    setError('');
    setDocumentation('');

    try {
      // Fetch repository information from GitHub API
      const repoResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
      
      if (!repoResponse.ok) {
        throw new Error('Repository not found or not accessible');
      }

      const repoData: RepoData = await repoResponse.json();

      // Fetch repository contents
      const contentsResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`);
      const contents: FileContent[] = await contentsResponse.json();

      // Fetch languages
      const languagesResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/languages`);
      const languages: Record<string, number> = await languagesResponse.json();

      // Build folder tree if enabled
      let folderTree = '';
      if (includeFolderTree) {
        toast.info('Building folder structure tree...');
        const tree = await buildFileTree(repoInfo.owner, repoInfo.repo);
        folderTree = renderTree(tree);
      }

      // Generate AI summary if enabled
      let aiSummary = '';
      if (includeAISummary) {
        toast.info('Generating AI-powered analysis...');
        aiSummary = await generateAISummary(repoData, contents, languages);
      }

      // Generate README content
      const readme = generateReadmeContent(repoData, contents, languages, folderTree, aiSummary);
      setDocumentation(readme);
      toast.success('Documentation generated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate documentation');
      toast.error('Failed to generate documentation');
    } finally {
      setLoading(false);
    }
  };

  const generateReadmeContent = (repoData: RepoData, contents: FileContent[], languages: Record<string, number>, folderTree: string, aiSummary: string) => {
    const languageList = Object.keys(languages).join(', ');
    const hasPackageJson = contents.some((file: FileContent) => file.name === 'package.json');
    const hasRequirementsTxt = contents.some((file: FileContent) => file.name === 'requirements.txt');
    const hasPomXml = contents.some((file: FileContent) => file.name === 'pom.xml');

    let installSection = '';
    if (hasPackageJson) {
      installSection = `## Installation

\`\`\`bash
# Clone the repository
git clone ${repoData.clone_url}

# Navigate to project directory
cd ${repoData.name}

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
\`\`\``;
    } else if (hasRequirementsTxt) {
      installSection = `## Installation

\`\`\`bash
# Clone the repository
git clone ${repoData.clone_url}

# Navigate to project directory
cd ${repoData.name}

# Install dependencies
pip install -r requirements.txt
\`\`\``;
    } else if (hasPomXml) {
      installSection = `## Installation

\`\`\`bash
# Clone the repository
git clone ${repoData.clone_url}

# Navigate to project directory
cd ${repoData.name}

# Build the project
mvn clean install
\`\`\``;
    } else {
      installSection = `## Installation

\`\`\`bash
# Clone the repository
git clone ${repoData.clone_url}

# Navigate to project directory
cd ${repoData.name}
\`\`\``;
    }

    const folderStructureSection = folderTree ? `

## 📁 Project Structure

\`\`\`
${repoData.name}/
${folderTree}
\`\`\`
` : '';

    const aiSummarySection = aiSummary ? `

${aiSummary}
` : '';

    return `# ${repoData.name}

${repoData.description || 'A GitHub repository'}

## 📋 Table of Contents

- [About](#about)${aiSummary ? '\n- [AI-Generated Project Analysis](#ai-generated-project-analysis)' : ''}
- [Technologies](#technologies)${folderTree ? '\n- [Project Structure](#project-structure)' : ''}
- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## 🎯 About

${repoData.description || 'This project provides various functionalities and features.'}

**Repository Stats:**
- ⭐ Stars: ${repoData.stargazers_count}
- 🍴 Forks: ${repoData.forks_count}
- 👁️ Watchers: ${repoData.watchers_count}
- 🐛 Open Issues: ${repoData.open_issues_count}
${aiSummarySection}
## 🛠️ Technologies

This project is built with:

${languageList ? `- ${languageList.split(', ').join('\n- ')}` : '- Check repository for details'}
${folderStructureSection}
${installSection}

## 🚀 Usage

\`\`\`bash
# Add specific usage instructions here
# Example: npm start, python main.py, etc.
\`\`\`

For detailed usage instructions, please refer to the project documentation or source code.

## ✨ Features

- Feature 1: [Describe key feature]
- Feature 2: [Describe key feature]
- Feature 3: [Describe key feature]

*Note: Review the codebase to identify and list specific features*

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## 📄 License

${repoData.license ? `This project is licensed under the ${repoData.license.name} - see the [LICENSE](LICENSE) file for details.` : 'License information not available. Please check the repository for license details.'}

## 📧 Contact

**Project Link:** [${repoData.html_url}](${repoData.html_url})

**Author:** [${repoData.owner.login}](${repoData.owner.html_url})

---

*Generated with ❤️ by Rakesh Kumar*
`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(documentation);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReadme = () => {
    const blob = new Blob([documentation], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('README.md downloaded!');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                GitHub Documentation Generator
              </h1>
              <p className="text-sm text-muted-foreground">Generate comprehensive README files for your repositories</p>
            </div>
            <Badge variant="secondary" className="ml-auto gap-1">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="w-5 h-5" />
                Repository Input
              </CardTitle>
              <CardDescription>
                Enter your GitHub repository URL to generate documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository URL</label>
                <Input
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && generateDocumentation()}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Example: https://github.com/facebook/react
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 bg-linear-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <Checkbox
                    id="aiSummary"
                    checked={includeAISummary}
                    onCheckedChange={(checked) => setIncludeAISummary(checked as boolean)}
                  />
                  <label
                    htmlFor="aiSummary"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Include AI-powered project analysis
                  </label>
                </div>

                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="folderTree"
                    checked={includeFolderTree}
                    onCheckedChange={(checked) => setIncludeFolderTree(checked as boolean)}
                  />
                  <label
                    htmlFor="folderTree"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <FolderTree className="w-4 h-4 text-blue-600" />
                    Include folder structure tree
                  </label>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={generateDocumentation}
                disabled={loading}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Documentation
                  </>
                )}
              </Button>

              {/* Features List */}
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3 text-sm">What's included:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Project overview and description</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <span>AI-powered project analysis (NEW!)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Technology stack detection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Folder structure tree (optional)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Installation instructions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Repository statistics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Quality indicators & recommendations</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Generated Documentation
                </span>
                {documentation && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadReadme}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Your README.md content will appear here
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentation ? (
                <Textarea
                  value={documentation}
                  readOnly
                  className="font-mono text-xs h-[600px] resize-none"
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center border-2 border-dashed rounded-lg bg-slate-50">
                  <div className="text-center space-y-3 p-6">
                    <FileText className="w-16 h-16 mx-auto text-slate-300" />
                    <p className="text-muted-foreground">
                      Enter a GitHub repository URL and click "Generate Documentation"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The generated README will appear here
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-6 bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">AI-Powered Analysis</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This tool now features intelligent project analysis! It automatically detects project type, 
                  analyzes code structure, identifies quality indicators (tests, CI/CD, Docker), evaluates 
                  project maturity, and provides smart recommendations for use cases. All without requiring 
                  any API keys or authentication!
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium border">
                    No Authentication Required
                  </span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium border">
                    Public Repos Only
                  </span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium border">
                    Instant Generation
                  </span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium border">
                    AI Analysis
                  </span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium border">
                    Folder Tree Visualization
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      {/* <footer className="border-t mt-12 py-6 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with ❤️ By Rakesh</p>
        </div>
      </footer> */}
      <footer className="border-t mt-12 py-6 bg-white/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p className="mb-3">Built with ❤️ by Rakesh</p>

        <div className="flex justify-center gap-4 text-gray-600">
          <a
            href="https://github.com/Rakesh709"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            <Github size={20} />
          </a>

          <a
            href="https://www.linkedin.com/in/rakesh-kumar07"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            <Linkedin size={20} />
          </a>

          <a
            href="https://www.youtube.com/@bucketflow"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            <Youtube size={20} />
          </a>

          <a
            href="https://portfolio-ten-omega-11.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            <Globe size={20} />
          </a>
        </div>
      </div>
    </footer>
    </div>
  );
}