import os
import sys
import subprocess
import venv  # Built-in Python standard library for managing virtual environments

def get_project_paths():
    """
    Dynamically resolves paths relative to where this script is saved.
    This removes all concrete, hardcoded system pathways.
    """
    # Locates the exact directory containing this app.py file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Assumes the batch file sits in the exact same directory
    batch_script = os.path.join(script_dir, "WhisperXDiarize.bat")
    
    # Looks for the virtual environment inside a folder named 'whisperx-env' next to app.py
    default_venv = os.path.join(script_dir, "whisperx-env")
    
    return script_dir, batch_script, default_venv

def ensure_virtual_environment(venv_dir):
    """
    Verifies if the required virtual environment exists. If it is missing, 
    it programmatically builds it and installs all WhisperX CUDA dependencies.
    """
    if os.path.exists(venv_dir):
        return True  # Environment exists! Move forward.

    print("\n" + "="*60)
    print("          AUTOMATED PIPELINE WORKSPACE SETUP           ")
    print("="*60)
    print(f"Notice: Local environment 'whisperx-env' was not found at:\n{venv_dir}")
    print("\nThe system can automatically construct this environment and install")
    print("the required PyTorch CUDA neural networks and WhisperX binaries.")
    print("WARNING: This involves a multi-gigabyte download and can take")
    print("several minutes to finish depending on your internet connection.")
    print("="*60)
    
    confirm = input("Would you like to run the automatic installation now? (y/n): ").strip().lower()
    if confirm not in ['y', 'yes']:
        print("Setup cancelled. The pipeline cannot run without its environment.")
        return False

    try:
        # Step 1: Initialize the core environment structure with pip
        print("\n[Step 1/5] Initializing local virtual environment container...")
        venv.create(venv_dir, with_pip=True)
        
        # Explicitly locate the pip executable inside the newly created environment
        # This allows us to target this environment without dealing with terminal 'activate' commands!
        pip_exe = os.path.join(venv_dir, "Scripts", "pip.exe")
        
        # Step 2: Clear out default CPU-only PyTorch configurations to prevent system conflicts
        print("\n[Step 2/5] Purging standard non-GPU PyTorch installations...")
        subprocess.run([pip_exe, "uninstall", "-y", "torch", "torchvision", "torchaudio"], check=True)
        
        # Step 3: Install CUDA-optimized PyTorch matching the system graphics configuration
        print("\n[Step 3/5] Deploying CUDA 12.8 accelerated PyTorch architecture...")
        print("Downloading neural compute frameworks. Please do not close this window...")
        subprocess.run([
            pip_exe, "install", "torch", "torchvision", "torchaudio", 
            "--index-url", "https://download.pytorch.org/whl/cu128"
        ], check=True)
        
        # Step 4: Pull and install WhisperX from its direct registry
        print("\n[Step 4/5] Syncing WhisperX audio processing components...")
        subprocess.run([pip_exe, "install", "whisperx"], check=True)
        
        # Step 5: Update the backend openai-whisper package to finalize dependencies
        print("\n[Step 5/5] Finalizing core OpenAI Whisper processing engines...")
        subprocess.run([pip_exe, "install", "-U", "openai-whisper"], check=True)
        
        print("\n" + "="*60)
        print("SUCCESS: WhisperX virtual environment created and fully optimized!")
        print("="*60 + "\n")
        return True

    except Exception as e:
        print(f"\nCRITICAL ENVIRONMENT INITIALIZATION FAILURE: {e}")
        print("Please check your network link or disk permissions, delete the partial folder, and restart.")
        return False

def run_transcription_pipeline():
    script_dir, batch_script, venv_dir = get_project_paths()
    
    # System Check 1: Verify the execution batch asset is present
    if not os.path.exists(batch_script):
        print(f"CRITICAL ERROR: The required execution file '{os.path.basename(batch_script)}'")
        print(f"is missing from the script directory: {script_dir}")
        print("Please place the batch script and this python file in the same folder.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    # System Check 2: Verify or build the runtime virtual environment
    if not ensure_virtual_environment(venv_dir):
        input("\nPress Enter to exit...")
        sys.exit(1)

    print("====================================================")
    print("      WhisperX Automated Batch Audio Pipeline       ")
    print("====================================================")
    print("Type 'exit' or 'q' at any prompt to quit the program.\n")

    # --- MAIN INTERACTIVE LOOP ---
    while True:
        try:
            # 1. Capture and validate the Target Input Directory
            raw_in = input("Drop or type the target broadcast folder path: ").strip()
            
            # Allow clean exit check
            if raw_in.lower() in ['exit', 'q']:
                print("\nExiting pipeline. Goodbye!")
                break
                
            # Clean accidental wrapping quotes if user dragged-and-dropped a folder into the window
            input_dir = raw_in.strip('"').strip("'")
            
            if not input_dir:
                print("Error: Input path cannot be blank. Please try again.\n")
                continue
                
            if not os.path.isdir(input_dir):
                print(f"Error: The directory '{input_dir}' does not exist on this machine.")
                print("Please verify the drive letter or folder layout and try again.\n")
                continue

            # 2. Capture and validate the Hugging Face Security Token
            hf_token = input("Enter Hugging Face Token (required for speaker diarization): ").strip()
            
            if hf_token.lower() in ['exit', 'q']:
                print("\nExiting pipeline. Goodbye!")
                break
                
            if not hf_token:
                print("Error: Diarization requires an active Hugging Face developer token.\n")
                continue

            # 3. Programmatically establish output pathway structure
            output_dir = input_dir

            print("\n" + "-"*60)
            print("INITIALIZING PIPELINE CONFIGURATION:")
            print(f"  Target Input Path:  {input_dir}")
            print(f"  Output Subtitles:   {output_dir}")
            print(f"  Active Environment: {venv_dir}")
            print("-"*60 + "\n")

            # 4. Hand execution over to the shell process
            # subprocess.run with check=True automatically fires an exception if exit code != 0
            subprocess.run([
                batch_script, 
                input_dir, 
                output_dir, 
                hf_token, 
                venv_dir
            ], check=True)
            
            print("\n====================================================")
            print("SUCCESS: Batch processing loop completed successfully!")
            print("====================================================\n")
            
            print("Ready for next batch job allocation.")

        except subprocess.CalledProcessError as e:
            print("\n" + "!"*60)
            print("PIPELINE PROCESSING FAILURE DETECTED!")
            print(f"The batch environment returned an internal error code.")
            print("This usually means WhisperX encountered an error processing a media file,")
            print("or CUDA ran out of memory. Fix the issue and try again below.")
            print("!"*60 + "\n")
            continue  # Cycles cleanly back to the top of the while loop

        except KeyboardInterrupt:
            print("\n\nPipeline execution interrupted by operator terminal signal. Exiting.")
            break
            
        except Exception as e:
            print(f"\nAn unexpected systemic error occurred: {e}\nRestarting prompt sequence...\n")
            continue

if __name__ == "__main__":
    run_transcription_pipeline()