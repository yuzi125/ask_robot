from pydub import AudioSegment

# Load .wav file
input_file = "./test/file-ok.wav"
# input_file = "./test/file.wav"
# input_file = "./data/upload/file.wav"
audio = AudioSegment.from_wav(input_file)

# Define output path
output_path = "./data/upload/file-output.mp3"

# Export as .mp3
audio.export(output_path, format="mp3")

print(output_path)
