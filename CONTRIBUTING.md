# Contributing to Calendar-Task Sync

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose (for testing with services)
- Git

### Local Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/calendar-task-sync.git
cd calendar-task-sync

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your test credentials
nano .env

# Set up database
npx drizzle-kit push

# Seed default configuration
npm run db:seed

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/__tests__/engine/ranker.test.ts
```

All tests must pass before submitting a PR.

## Code Standards

### TypeScript
- No TypeScript errors: `npx tsc --noEmit`
- Use strict mode (enabled in tsconfig.json)
- Prefer explicit types over `any`

### Testing Requirements
- New features must include unit tests
- Aim for >80% code coverage
- Test both happy path and error cases

### Code Style
- Follow existing patterns in the codebase
- Use 2-space indentation (enforced by .editorconfig)
- Use meaningful variable and function names
- Add comments for complex logic

### Commits
- Use conventional commit format: `type(scope): description`
- Examples:
  - `feat(engine): add energy-aware scheduling`
  - `fix(google): handle calendar API rate limits`
  - `test(ranker): add edge case tests`
  - `docs: update configuration guide`

## Pull Request Process

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with clear messages

3. **Run tests and type checking**:
   ```bash
   npm test
   npx tsc --noEmit
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** with:
   - Clear description of changes
   - Reference to any related issues
   - Screenshots if UI changes
   - Test results showing all tests pass

6. **Address review feedback** and update your PR

## Project Structure

Key directories for contributions:

- `src/lib/engine/` - Core scheduling algorithm (pure functions, highly testable)
- `src/lib/tududi/` - Tududi API client
- `src/lib/google/` - Google Calendar integration
- `src/lib/sync/` - Sync orchestration
- `src/__tests__/` - Unit tests
- `src/app/` - Next.js pages and API routes

## Common Tasks

### Adding a New Feature

1. Create tests first (TDD approach)
2. Implement the feature
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR

### Fixing a Bug

1. Write a test that reproduces the bug
2. Fix the bug
3. Verify the test passes
4. Submit PR with test included

### Updating Documentation

1. Edit the relevant markdown file
2. Ensure clarity and accuracy
3. Submit PR

## Questions?

- Check existing issues and discussions
- Open a new issue for bugs or feature requests
- Use GitHub discussions for questions

## Code of Conduct

Be respectful and constructive. We welcome all contributors regardless of experience level.

Happy coding! 🚀
