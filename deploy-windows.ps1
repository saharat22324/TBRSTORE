# deploy-windows.ps1 - TBR System Deployment on Windows
# Usage: powershell -ExecutionPolicy Bypass -File deploy-windows.ps1

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 TBR System - Windows Deployment" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check if index.html exists
if (-not (Test-Path "index.html")) {
    Write-Host "❌ Error: index.html not found!" -ForegroundColor Red
    Write-Host "   Current directory: $ScriptDir" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Deployment Options:" -ForegroundColor Yellow
Write-Host "  1. Simple HTTP Server (Python)" -ForegroundColor White
Write-Host "  2. Docker Container" -ForegroundColor White
Write-Host "  3. Show Credentials Template" -ForegroundColor White
Write-Host "  4. Show RLS Enable Guide" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Select option (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🐍 Starting Python HTTP Server..." -ForegroundColor Green
        Write-Host ""
        
        $port = Read-Host "Enter port (default: 8080)"
        if ([string]::IsNullOrWhiteSpace($port)) { $port = 8080 }
        
        python deploy-simple.py $port
    }
    
    "2" {
        Write-Host ""
        Write-Host "🐳 Starting Docker Deployment..." -ForegroundColor Green
        Write-Host ""
        
        # Check Docker
        $docker = Get-Command docker -ErrorAction SilentlyContinue
        if (-not $docker) {
            Write-Host "❌ Docker not found!" -ForegroundColor Red
            Write-Host "   Install from: https://www.docker.com" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "📦 Building image..." -ForegroundColor Yellow
        docker build -t tbr-system:latest .
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Docker build failed!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "🛑 Stopping old container..." -ForegroundColor Yellow
        docker stop tbr-system 2>$null
        docker rm tbr-system 2>$null
        
        Write-Host ""
        Write-Host "🚀 Starting new container..." -ForegroundColor Green
        docker run -d `
            --name tbr-system `
            --restart always `
            -p 8080:8080 `
            -v "$ScriptDir`:C:\app" `
            tbr-system:latest
        
        Write-Host ""
        Write-Host "✅ Docker deployment successful!" -ForegroundColor Green
        Write-Host "📍 Access at: http://localhost:8080" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📋 Useful commands:" -ForegroundColor Yellow
        Write-Host "  - View logs: docker logs -f tbr-system" -ForegroundColor Gray
        Write-Host "  - Stop: docker stop tbr-system" -ForegroundColor Gray
        Write-Host "  - Start: docker start tbr-system" -ForegroundColor Gray
    }
    
    "3" {
        Write-Host ""
        Write-Host "📋 Production Credentials Template" -ForegroundColor Green
        Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Edit file: index.html (around line 20-30)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Current (Development):" -ForegroundColor Yellow
        Write-Host '  const SUPABASE_URL = "https://tgtuxvmuapiltmkulvlk.supabase.co";' -ForegroundColor Gray
        Write-Host '  const SUPABASE_KEY = "sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax";' -ForegroundColor Gray
        Write-Host ""
        Write-Host "Change to (Production):" -ForegroundColor Yellow
        Write-Host '  const SUPABASE_URL = "[YOUR_PRODUCTION_URL]";' -ForegroundColor Cyan
        Write-Host '  const SUPABASE_KEY = "[YOUR_PRODUCTION_KEY]";' -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Where to get production credentials:" -ForegroundColor Yellow
        Write-Host "  1. Create new Supabase project (separate from dev)" -ForegroundColor White
        Write-Host "  2. Go to: https://app.supabase.com" -ForegroundColor White
        Write-Host "  3. Select project → Settings → API" -ForegroundColor White
        Write-Host "  4. Copy: Project URL" -ForegroundColor White
        Write-Host "  5. Copy: Publishable Key (anon, NOT Service Role)" -ForegroundColor White
        Write-Host "  6. Paste into index.html" -ForegroundColor White
        Write-Host ""
    }
    
    "4" {
        Write-Host ""
        Write-Host "🔐 Enable RLS Policies - Step by Step" -ForegroundColor Green
        Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Step 1: Open Supabase" -ForegroundColor Yellow
        Write-Host "  Go to: https://app.supabase.com" -ForegroundColor White
        Write-Host "  Select: Your TBR System project" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 2: Open SQL Editor" -ForegroundColor Yellow
        Write-Host "  Click: SQL Editor (left sidebar)" -ForegroundColor White
        Write-Host "  Click: New Query" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 3: Copy SQL" -ForegroundColor Yellow
        Write-Host "  File: enable-rls-policies.sql" -ForegroundColor White
        Write-Host "  Action: Copy entire content" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 4: Paste & Run" -ForegroundColor Yellow
        Write-Host "  Paste in SQL Editor" -ForegroundColor White
        Write-Host "  Click: Run" -ForegroundColor White
        Write-Host "  Wait: 10-30 seconds" -ForegroundColor White
        Write-Host ""
        Write-Host "Step 5: Verify Success" -ForegroundColor Yellow
        Write-Host "  Look for: 'Success. No rows returned.'" -ForegroundColor White
        Write-Host "  Check: All 23 tables show 'RLS enabled'" -ForegroundColor White
        Write-Host ""
        Write-Host "Result:" -ForegroundColor Green
        Write-Host "  ✅ RLS policies are now active" -ForegroundColor Green
        Write-Host "  ✅ 3 roles working: admin, technician, front_desk" -ForegroundColor Green
        Write-Host "  ✅ Users can only access their data" -ForegroundColor Green
        Write-Host ""
    }
    
    default {
        Write-Host "Invalid option!" -ForegroundColor Red
        exit 1
    }
}
