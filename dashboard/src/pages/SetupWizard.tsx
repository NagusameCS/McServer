import { useState } from 'react';
import { CheckCircle, Circle, ChevronRight, ChevronLeft, Loader2, ExternalLink } from 'lucide-react';

interface WizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'java' | 'github' | 'profile' | 'complete';

interface StepInfo {
  id: Step;
  title: string;
  description: string;
}

const steps: StepInfo[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with McServer' },
  { id: 'java', title: 'Java Check', description: 'Verify Java installation' },
  { id: 'github', title: 'GitHub Setup', description: 'Configure world sync' },
  { id: 'profile', title: 'Create Server', description: 'Set up your first server' },
  { id: 'complete', title: 'Complete', description: 'You\'re all set!' }
];

export default function SetupWizard({ onComplete }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [javaStatus, setJavaStatus] = useState<'checking' | 'found' | 'missing' | null>(null);
  const [javaVersion, setJavaVersion] = useState<string | null>(null);
  
  // Form states
  const [githubConfig, setGithubConfig] = useState({
    token: '',
    owner: '',
    repo: 'minecraft-worlds',
    skipGithub: false
  });
  
  const [profileConfig, setProfileConfig] = useState({
    name: 'My Minecraft Server',
    type: 'vanilla' as 'vanilla' | 'fabric' | 'forge',
    version: '1.20.4',
    maxPlayers: 10
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const checkJava = async () => {
    setJavaStatus('checking');
    try {
      const response = await fetch('/api/system/java');
      const data = await response.json();
      if (data.version) {
        setJavaVersion(data.version);
        setJavaStatus('found');
      } else {
        setJavaStatus('missing');
      }
    } catch {
      setJavaStatus('missing');
    }
  };

  const saveGitHubConfig = async () => {
    if (githubConfig.skipGithub) return true;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/config/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubConfig.token,
          owner: githubConfig.owner,
          repo: githubConfig.repo,
          branch: 'main',
          lfsEnabled: true
        })
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const createProfile = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileConfig)
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('java');
        checkJava();
        break;
      case 'java':
        setCurrentStep('github');
        break;
      case 'github':
        if (await saveGitHubConfig()) {
          setCurrentStep('profile');
        }
        break;
      case 'profile':
        if (await createProfile()) {
          setCurrentStep('complete');
        }
        break;
      case 'complete':
        // Mark setup as complete
        try {
          await fetch('/api/config/setup-complete', { method: 'POST' });
        } catch {}
        onComplete();
        break;
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };


  const canProceed = () => {
    switch (currentStep) {
      case 'java':
        return javaStatus === 'found' || javaStatus === 'missing';
      case 'github':
        return githubConfig.skipGithub || (githubConfig.token && githubConfig.owner && githubConfig.repo);
      case 'profile':
        return profileConfig.name && profileConfig.version;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="McServer" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">McServer Setup</h1>
          <p className="text-gray-400 mt-2">Let's get your Minecraft server running</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 px-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index < currentStepIndex 
                    ? 'bg-green-500' 
                    : index === currentStepIndex 
                      ? 'bg-minecraft-grass' 
                      : 'bg-gray-700'
                }`}>
                  {index < currentStepIndex ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <span className="text-white font-bold">{index + 1}</span>
                  )}
                </div>
                <span className={`text-xs mt-2 ${
                  index <= currentStepIndex ? 'text-white' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-2 mt-[-20px] ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🎮</div>
              <h2 className="text-2xl font-bold text-white mb-4">Welcome to McServer!</h2>
              <p className="text-gray-300 mb-6">
                McServer makes it easy to host and share Minecraft servers with your friends.
                This wizard will help you set everything up in just a few minutes.
              </p>
              <div className="grid grid-cols-2 gap-4 text-left mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-minecraft-grass font-bold mb-2">🔄 World Sync</div>
                  <p className="text-sm text-gray-400">Share worlds with friends using GitHub</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-minecraft-grass font-bold mb-2">🌐 No Port Forward</div>
                  <p className="text-sm text-gray-400">Players connect without networking setup</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-minecraft-grass font-bold mb-2">📦 Mod Support</div>
                  <p className="text-sm text-gray-400">Fabric and Forge fully supported</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-minecraft-grass font-bold mb-2">💾 Auto Backups</div>
                  <p className="text-sm text-gray-400">Never lose your world progress</p>
                </div>
              </div>
            </div>
          )}

          {/* Java Check Step */}
          {currentStep === 'java' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Java Installation</h2>
              <p className="text-gray-300 mb-6">
                Minecraft servers require Java 17 or newer to run.
              </p>
              
              <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
                {javaStatus === 'checking' && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-minecraft-grass animate-spin" />
                    <span className="text-white">Checking Java installation...</span>
                  </div>
                )}
                {javaStatus === 'found' && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <span className="text-white font-bold">Java Found!</span>
                      <p className="text-gray-400 text-sm">{javaVersion}</p>
                    </div>
                  </div>
                )}
                {javaStatus === 'missing' && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <Circle className="w-6 h-6 text-yellow-500" />
                      <span className="text-white font-bold">Java Not Found</span>
                    </div>
                    <p className="text-gray-400 mb-4">
                      Java 17+ is required. You can continue setup and install it later.
                    </p>
                    <a 
                      href="https://adoptium.net/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-minecraft-grass hover:underline"
                    >
                      Download Java from Adoptium <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GitHub Setup Step */}
          {currentStep === 'github' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">GitHub World Sync</h2>
              <p className="text-gray-300 mb-6">
                McServer uses GitHub to sync your worlds between computers. 
                This lets you and your friends take turns hosting the same world.
              </p>
              
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={githubConfig.skipGithub}
                    onChange={(e) => setGithubConfig(prev => ({ ...prev, skipGithub: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-minecraft-grass focus:ring-minecraft-grass"
                  />
                  <span className="text-gray-300">Skip for now (configure later in Settings)</span>
                </label>
              </div>

              {!githubConfig.skipGithub && (
                <div className="space-y-4">
                  <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                    <h3 className="text-white font-bold mb-2">How to get a GitHub token:</h3>
                    <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-minecraft-grass hover:underline">github.com/settings/tokens</a></li>
                      <li>Click "Generate new token (classic)"</li>
                      <li>Select scopes: <code className="bg-gray-800 px-1 rounded">repo</code></li>
                      <li>Copy the token and paste below</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      GitHub Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={githubConfig.token}
                      onChange={(e) => setGithubConfig(prev => ({ ...prev, token: e.target.value }))}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      GitHub Username
                    </label>
                    <input
                      type="text"
                      value={githubConfig.owner}
                      onChange={(e) => setGithubConfig(prev => ({ ...prev, owner: e.target.value }))}
                      placeholder="your-username"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      value={githubConfig.repo}
                      onChange={(e) => setGithubConfig(prev => ({ ...prev, repo: e.target.value }))}
                      placeholder="minecraft-worlds"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                    />
                    <p className="text-xs text-gray-500 mt-1">Will be created if it doesn't exist</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create Profile Step */}
          {currentStep === 'profile' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Create Your Server</h2>
              <p className="text-gray-300 mb-6">
                Set up your first Minecraft server profile.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={profileConfig.name}
                    onChange={(e) => setProfileConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Minecraft Server"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Server Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['vanilla', 'fabric', 'forge'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setProfileConfig(prev => ({ ...prev, type }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          profileConfig.type === type
                            ? 'border-minecraft-grass bg-minecraft-grass/20'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-2xl mb-1">
                          {type === 'vanilla' ? '🎮' : type === 'fabric' ? '🧵' : '🔨'}
                        </div>
                        <div className="text-white font-bold capitalize">{type}</div>
                        <div className="text-xs text-gray-400">
                          {type === 'vanilla' ? 'Official' : type === 'fabric' ? 'Lightweight' : 'Full mods'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minecraft Version
                    </label>
                    <input
                      type="text"
                      value={profileConfig.version}
                      onChange={(e) => setProfileConfig(prev => ({ ...prev, version: e.target.value }))}
                      placeholder="1.20.4"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Players
                    </label>
                    <input
                      type="number"
                      value={profileConfig.maxPlayers}
                      onChange={(e) => setProfileConfig(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 10 }))}
                      min={1}
                      max={100}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-minecraft-grass"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-4">You're All Set!</h2>
              <p className="text-gray-300 mb-6">
                McServer is configured and ready to go. Click finish to open the dashboard.
              </p>
              
              <div className="bg-gray-700/50 rounded-lg p-6 text-left mb-6">
                <h3 className="text-white font-bold mb-3">Quick Start Commands</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                    <code className="text-minecraft-grass">Start Server</code>
                    <span className="text-gray-400 text-sm">Click "Start" on dashboard</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                    <code className="text-minecraft-grass">Add Mods</code>
                    <span className="text-gray-400 text-sm">Go to Mods tab</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-800 rounded p-2">
                    <code className="text-minecraft-grass">Invite Friends</code>
                    <span className="text-gray-400 text-sm">Share the tunnel URL</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                currentStepIndex === 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            
            <button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold transition-all ${
                canProceed() && !isSubmitting
                  ? 'bg-minecraft-grass hover:bg-minecraft-grass-dark text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentStep === 'complete' ? (
                'Finish'
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
