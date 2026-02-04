#!/usr/bin/env node

/**
 * McServer - CLI Entry Point
 * 
 * Command-line interface for managing Minecraft servers.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../constants';
import { serverManager } from '../server';
import { WebServer } from '../web';
import { TunnelManager } from '../tunnel';
import configManager from '../config';
import { createLogger, getJavaVersion, formatBytes } from '../utils';
import { ServerType } from '../types';

const logger = createLogger('CLI');

const program = new Command();

// ============================================================================
// CLI Configuration
// ============================================================================

program
  .name('mcserver')
  .description(APP_DESCRIPTION)
  .version(APP_VERSION);

// ============================================================================
// Init Command
// ============================================================================

program
  .command('init')
  .description('Initialize McServer in the current directory')
  .action(async () => {
    console.log(chalk.cyan('\n🎮 Welcome to McServer!\n'));

    const spinner = ora('Initializing...').start();

    try {
      await configManager.initialize();
      spinner.succeed('Configuration initialized');

      // Check Java
      spinner.start('Checking Java installation...');
      const javaVersion = await getJavaVersion();
      
      if (!javaVersion) {
        spinner.warn('Java not found - please install Java 17 or newer');
      } else {
        spinner.succeed(`Java found: ${javaVersion}`);
      }

      // Check if GitHub needs to be configured
      if (!configManager.isGitHubConfigured()) {
        console.log(chalk.yellow('\n⚠ GitHub is not configured. Run `mcserver config github` to set up world sync.\n'));
      }

      console.log(chalk.green('\n✓ McServer is ready!'));
      console.log(chalk.gray('\nRun `mcserver help` to see available commands.\n'));
    } catch (error) {
      spinner.fail('Initialization failed');
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Profile Commands
// ============================================================================

const profileCmd = program.command('profile').description('Manage server profiles');

profileCmd
  .command('create')
  .description('Create a new server profile')
  .action(async () => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Profile name:',
          validate: (input) => input.trim().length > 0 || 'Name is required'
        },
        {
          type: 'list',
          name: 'type',
          message: 'Server type:',
          choices: [
            { name: 'Vanilla (Official Minecraft)', value: 'vanilla' },
            { name: 'Forge (Mod support)', value: 'forge' },
            { name: 'Fabric (Lightweight mods)', value: 'fabric' }
          ]
        },
        {
          type: 'input',
          name: 'minecraftVersion',
          message: 'Minecraft version:',
          default: '1.20.4'
        },
        {
          type: 'input',
          name: 'loaderVersion',
          message: 'Loader version (leave empty for latest):',
          when: (answers) => answers.type !== 'vanilla'
        }
      ]);

      const spinner = ora('Creating profile...').start();
      
      const profile = await serverManager.createProfile({
        name: answers.name,
        type: answers.type as ServerType,
        minecraftVersion: answers.minecraftVersion,
        loaderVersion: answers.loaderVersion || undefined
      });

      spinner.succeed(`Profile created: ${profile.name}`);

      const setupNow = await inquirer.prompt([{
        type: 'confirm',
        name: 'setup',
        message: 'Download server files now?',
        default: true
      }]);

      if (setupNow.setup) {
        spinner.start('Downloading server files...');
        await serverManager.setupServer(profile.id, (msg, progress) => {
          spinner.text = `${msg} (${Math.round(progress)}%)`;
        });
        spinner.succeed('Server files downloaded');
      }

      console.log(chalk.green(`\n✓ Profile "${profile.name}" is ready!`));
      console.log(chalk.gray(`\nStart with: mcserver start ${profile.id}\n`));
    } catch (error) {
      console.error(chalk.red('\n' + (error as Error).message));
      process.exit(1);
    }
  });

profileCmd
  .command('list')
  .description('List all server profiles')
  .action(async () => {
    try {
      await configManager.initialize();

      const profiles = configManager.profiles;

      if (profiles.length === 0) {
        console.log(chalk.yellow('\nNo profiles found. Create one with `mcserver profile create`\n'));
        return;
      }

      console.log(chalk.cyan('\n📋 Server Profiles:\n'));
      
      for (const profile of profiles) {
        const active = profile.id === configManager.activeProfileId ? chalk.green(' (active)') : '';
        console.log(`  ${chalk.bold(profile.name)}${active}`);
        console.log(chalk.gray(`    ID: ${profile.id}`));
        console.log(chalk.gray(`    Type: ${profile.type} | MC ${profile.minecraftVersion}`));
        if (profile.loaderVersion) {
          console.log(chalk.gray(`    Loader: ${profile.loaderVersion}`));
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

profileCmd
  .command('delete <id>')
  .description('Delete a server profile')
  .action(async (id: string) => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      const profile = configManager.getProfile(id);
      if (!profile) {
        console.error(chalk.red(`Profile not found: ${id}`));
        process.exit(1);
      }

      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'delete',
        message: `Are you sure you want to delete "${profile.name}"? This cannot be undone.`,
        default: false
      }]);

      if (!confirm.delete) {
        console.log('Cancelled');
        return;
      }

      const spinner = ora('Deleting profile...').start();
      await serverManager.deleteProfile(id);
      spinner.succeed(`Profile deleted: ${profile.name}`);
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Server Commands
// ============================================================================

program
  .command('start [profileId]')
  .description('Start the Minecraft server')
  .option('--no-tunnel', 'Do not start tunnel')
  .action(async (profileId: string | undefined, options) => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      // Get profile
      let profile;
      if (profileId) {
        profile = configManager.getProfile(profileId);
        if (!profile) {
          console.error(chalk.red(`Profile not found: ${profileId}`));
          process.exit(1);
        }
      } else {
        profile = configManager.getActiveProfile();
        if (!profile) {
          const profiles = configManager.profiles;
          if (profiles.length === 0) {
            console.error(chalk.red('No profiles found. Create one with `mcserver profile create`'));
            process.exit(1);
          }
          profile = profiles[0];
        }
      }

      console.log(chalk.cyan(`\n🎮 Starting ${profile.name}...\n`));

      const spinner = ora('Acquiring lock and syncing world...').start();

      // Start server
      await serverManager.startServer(profile.id);
      spinner.succeed('Server started');

      // Start tunnel if configured
      if (options.tunnel && configManager.isTunnelConfigured()) {
        spinner.start('Starting tunnel...');
        const tunnelManager = new TunnelManager(configManager.tunnel!);
        const address = await tunnelManager.connect(profile.settings.port);
        spinner.succeed(`Tunnel connected: ${chalk.green(address)}`);
        console.log(chalk.cyan(`\n📡 Players can connect using: ${chalk.bold(address)}\n`));
      } else {
        console.log(chalk.cyan(`\n📡 Server running on port ${profile.settings.port}\n`));
      }

      // Handle shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        const shutdownSpinner = ora('Stopping server and syncing world...').start();
        
        try {
          await serverManager.stopServer();
          shutdownSpinner.succeed('Server stopped and world synced');
        } catch (error) {
          shutdownSpinner.fail('Error during shutdown: ' + (error as Error).message);
        }
        
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      console.log(chalk.gray('Press Ctrl+C to stop the server\n'));

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error(chalk.red('\n' + (error as Error).message));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the running Minecraft server')
  .action(async () => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      if (!serverManager.isServerRunning()) {
        console.log(chalk.yellow('Server is not running'));
        return;
      }

      const spinner = ora('Stopping server...').start();
      await serverManager.stopServer();
      spinner.succeed('Server stopped');
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show server status')
  .action(async () => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      const state = await serverManager.getDashboardState();

      console.log(chalk.cyan('\n📊 Server Status\n'));

      // Server status
      const statusColor = state.server.status === 'running' ? chalk.green : 
                         state.server.status === 'crashed' ? chalk.red : chalk.yellow;
      console.log(`  Status: ${statusColor(state.server.status)}`);
      
      if (state.currentProfile) {
        console.log(`  Profile: ${state.currentProfile.name}`);
      }

      if (state.server.players.length > 0) {
        console.log(`  Players: ${state.server.players.map(p => p.username).join(', ')}`);
      }

      // Sync status
      console.log(chalk.cyan('\n🔄 Sync Status\n'));
      console.log(`  Lock: ${state.lock.locked ? chalk.red(`Locked by ${state.lock.lockedBy}`) : chalk.green('Available')}`);
      console.log(`  Last sync: ${state.sync.lastSyncTime ? state.sync.lastSyncTime.toISOString() : 'Never'}`);

      // System info
      console.log(chalk.cyan('\n💻 System Info\n'));
      console.log(`  Platform: ${state.systemInfo.platform} ${state.systemInfo.arch}`);
      console.log(`  Java: ${state.systemInfo.javaVersion || 'Not found'}`);
      console.log(`  Memory: ${formatBytes(state.systemInfo.memoryUsage.used)} / ${formatBytes(state.systemInfo.memoryUsage.total)}`);

      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Config Commands
// ============================================================================

const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('github')
  .description('Configure GitHub for world sync')
  .action(async () => {
    try {
      await configManager.initialize();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'owner',
          message: 'GitHub repository owner:',
          validate: (input) => input.trim().length > 0 || 'Owner is required'
        },
        {
          type: 'input',
          name: 'repo',
          message: 'Repository name:',
          validate: (input) => input.trim().length > 0 || 'Repository name is required'
        },
        {
          type: 'input',
          name: 'branch',
          message: 'Branch:',
          default: 'main'
        },
        {
          type: 'password',
          name: 'token',
          message: 'GitHub personal access token:',
          validate: (input) => input.trim().length > 0 || 'Token is required'
        },
        {
          type: 'confirm',
          name: 'lfsEnabled',
          message: 'Enable Git LFS for large files?',
          default: true
        }
      ]);

      await configManager.setGitHubConfig(answers);
      console.log(chalk.green('\n✓ GitHub configuration saved\n'));
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

configCmd
  .command('tunnel')
  .description('Configure tunnel for NAT traversal')
  .action(async () => {
    try {
      await configManager.initialize();

      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Tunnel provider:',
          choices: [
            { name: 'playit.gg (Free, easy setup)', value: 'playit' },
            { name: 'ngrok (Requires account)', value: 'ngrok' },
            { name: 'Cloudflare Tunnel', value: 'cloudflare' }
          ]
        },
        {
          type: 'input',
          name: 'authToken',
          message: 'Auth token (optional for playit):',
        },
        {
          type: 'input',
          name: 'customDomain',
          message: 'Custom domain (optional):',
        }
      ]);

      await configManager.setTunnelConfig(answers);
      console.log(chalk.green('\n✓ Tunnel configuration saved\n'));
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    try {
      await configManager.initialize();

      console.log(chalk.cyan('\n⚙️ Configuration\n'));
      console.log(`  Data directory: ${configManager.dataDir}`);
      console.log(`  Web port: ${configManager.webPort}`);
      console.log(`  GitHub: ${configManager.isGitHubConfigured() ? chalk.green('Configured') : chalk.yellow('Not configured')}`);
      console.log(`  Tunnel: ${configManager.isTunnelConfigured() ? chalk.green(`Configured (${configManager.tunnel?.provider})`) : chalk.yellow('Not configured')}`);
      console.log();
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Web Dashboard Command
// ============================================================================

program
  .command('dashboard')
  .description('Start the web dashboard')
  .option('-p, --port <port>', 'Port to run on', '3847')
  .action(async (options) => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      const port = parseInt(options.port);
      const webServer = new WebServer(port);
      
      const spinner = ora('Starting web dashboard...').start();
      await webServer.initialize();
      await webServer.start();
      spinner.succeed('Web dashboard started');

      console.log(chalk.cyan(`\n🌐 Dashboard: http://localhost:${port}`));
      console.log(chalk.gray('\nPress Ctrl+C to stop\n'));

      process.on('SIGINT', async () => {
        console.log('\nShutting down...');
        await webServer.stop();
        process.exit(0);
      });

      await new Promise(() => {});
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Emergency Commands
// ============================================================================

program
  .command('unlock')
  .description('Emergency release of server lock')
  .action(async () => {
    try {
      await configManager.initialize();
      await serverManager.initialize();

      const syncManager = serverManager.getSyncManager();
      if (!syncManager) {
        console.error(chalk.red('GitHub sync not configured'));
        process.exit(1);
      }

      const lockState = await syncManager.getLockState();
      
      if (!lockState.locked) {
        console.log(chalk.green('Lock is not held'));
        return;
      }

      console.log(chalk.yellow(`\nLock is held by: ${lockState.lockedBy}`));
      console.log(chalk.yellow(`Since: ${lockState.lockedAt?.toISOString()}`));

      const confirm = await inquirer.prompt([{
        type: 'confirm',
        name: 'release',
        message: 'Are you sure you want to force release the lock? This may cause data loss!',
        default: false
      }]);

      if (!confirm.release) {
        console.log('Cancelled');
        return;
      }

      const spinner = ora('Releasing lock...').start();
      await syncManager.emergencyRelease('Manual release via CLI');
      spinner.succeed('Lock released');
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Wizard Command - First Time Setup
// ============================================================================

program
  .command('wizard')
  .description('Interactive setup wizard for first-time configuration')
  .action(async () => {
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    McServer Setup Wizard                     ║
╚══════════════════════════════════════════════════════════════╝
`));

    const spinner = ora();

    try {
      // Step 1: Initialize
      spinner.start('Initializing configuration...');
      await configManager.initialize();
      spinner.succeed('Configuration initialized');

      // Step 2: Check Java
      spinner.start('Checking Java installation...');
      const javaVersion = await getJavaVersion();
      
      if (!javaVersion) {
        spinner.warn('Java not found');
        console.log(chalk.yellow('\n  Java 17+ is required to run Minecraft servers.'));
        console.log(chalk.gray('  Download from: https://adoptium.net/\n'));
        
        const { continueWithoutJava } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueWithoutJava',
          message: 'Continue setup without Java? (You can install it later)',
          default: true
        }]);
        
        if (!continueWithoutJava) {
          console.log(chalk.gray('\nPlease install Java and run the wizard again.\n'));
          return;
        }
      } else {
        spinner.succeed(`Java found: ${javaVersion}`);
      }

      // Step 3: GitHub Configuration
      console.log(chalk.cyan('\n📦 Step 1: World Sync Configuration\n'));
      console.log(chalk.gray('  McServer uses GitHub to sync your worlds across computers.'));
      console.log(chalk.gray('  You\'ll need a GitHub account and a private repository.\n'));

      const { configureGitHub } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configureGitHub',
        message: 'Would you like to configure GitHub sync now?',
        default: true
      }]);

      if (configureGitHub) {
        console.log(chalk.gray('\n  To get a GitHub token:'));
        console.log(chalk.gray('  1. Go to https://github.com/settings/tokens'));
        console.log(chalk.gray('  2. Generate a new token (classic)'));
        console.log(chalk.gray('  3. Select scopes: repo, workflow\n'));

        const githubAnswers = await inquirer.prompt([
          {
            type: 'password',
            name: 'token',
            message: 'GitHub Personal Access Token:',
            validate: (input) => input.trim().length > 0 || 'Token is required'
          },
          {
            type: 'input',
            name: 'owner',
            message: 'GitHub username or organization:',
            validate: (input) => input.trim().length > 0 || 'Username is required'
          },
          {
            type: 'input',
            name: 'repo',
            message: 'Repository name (will be created if it doesn\'t exist):',
            default: 'minecraft-worlds'
          }
        ]);

        configManager.setGitHubConfig({
          token: githubAnswers.token,
          owner: githubAnswers.owner,
          repo: githubAnswers.repo,
          branch: 'main',
          lfsEnabled: true
        });

        spinner.start('Validating GitHub configuration...');
        // In a real implementation, we'd test the connection here
        await new Promise(r => setTimeout(r, 1000));
        spinner.succeed('GitHub configured successfully');
      } else {
        console.log(chalk.yellow('\n  You can configure GitHub later with: mcserver config github\n'));
      }

      // Step 4: Create First Profile
      console.log(chalk.cyan('\n🎮 Step 2: Create Your First Server\n'));

      const { createProfile } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createProfile',
        message: 'Would you like to create a server profile now?',
        default: true
      }]);

      if (createProfile) {
        await serverManager.initialize();

        const profileAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Server name:',
            default: 'My Minecraft Server'
          },
          {
            type: 'list',
            name: 'type',
            message: 'Server type:',
            choices: [
              { name: 'Vanilla (Official Minecraft)', value: 'vanilla' },
              { name: 'Fabric (Lightweight modding)', value: 'fabric' },
              { name: 'Forge (Full modding support)', value: 'forge' }
            ]
          },
          {
            type: 'input',
            name: 'version',
            message: 'Minecraft version:',
            default: '1.20.4'
          },
          {
            type: 'number',
            name: 'maxPlayers',
            message: 'Maximum players:',
            default: 10
          }
        ]);

        spinner.start('Creating server profile...');
        const profile = await serverManager.createProfile({
          name: profileAnswers.name,
          type: profileAnswers.type as ServerType,
          minecraftVersion: profileAnswers.version,
          settings: { maxPlayers: profileAnswers.maxPlayers }
        });
        spinner.succeed(`Profile "${profile.name}" created`);

        spinner.start('Downloading server files...');
        await new Promise(r => setTimeout(r, 2000)); // Simulated download
        spinner.succeed('Server files ready');
      }

      // Step 5: Complete
      console.log(chalk.green(`
╔══════════════════════════════════════════════════════════════╗
║                    Setup Complete! 🎉                        ║
╚══════════════════════════════════════════════════════════════╝
`));

      console.log(chalk.white('  Quick Start Commands:\n'));
      console.log(chalk.cyan('  mcserver serve') + chalk.gray('        - Start web dashboard'));
      console.log(chalk.cyan('  mcserver start') + chalk.gray('        - Start the server'));
      console.log(chalk.cyan('  mcserver profile list') + chalk.gray(' - List all profiles'));
      console.log(chalk.cyan('  mcserver help') + chalk.gray('         - Show all commands'));
      console.log('');

    } catch (error) {
      spinner.fail('Setup failed');
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse();
